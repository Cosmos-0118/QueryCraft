import type { QueryResult, StatementQueryResult, TableSchema, Row } from '@/types/database';
import { sqlErrorEngine } from '@/lib/engine/sql-error-engine';
import { loadSqlJs, resetSqlJsLoader } from './sqljs-loader';
import { stripComments } from './utils';
import { translateMySQL } from './translation';
import { splitSqlStatements } from './statement-splitter';
import { isPlSqlBlock, runPlSqlBlock } from './plsql-runtime';
import { extractCursorDefinitions } from './mysql-compat';
import { rewriteViewUpdate, rewriteViewDelete, rewriteViewInsert } from './view-manager';
import { extractLeadingSqlVerb, extractPrivilegeTableTargets, replaceSqlIdentifiers } from './sql-lexer';
import type { SqlJs, SqlJsDatabase, SupportedPrivilege, DbUser, GrantEntry } from './types';
import { SUPPORTED_PRIVILEGES } from './types';
import {
  handleAlterTableCompatibility as handleAlterTableCompatibilityExternal,
  type AlterTableCompatibilityContext,
} from './internal/alter-table-compat';
import {
  handleDatabaseCommand as handleDatabaseCommandExternal,
  type DatabaseCommandContext,
} from './internal/database-commands';

interface ProcedureParam {
  name: string;
  mode: 'IN' | 'OUT' | 'INOUT';
}

interface StoredProcedure {
  database: string;
  name: string;
  params: ProcedureParam[];
  body: string;
  definition: string;
}

interface StoredTrigger {
  database: string;
  name: string;
  table: string;
  definition: string;
  sqliteDefinition: string;
}

interface StoredCursor {
  database: string;
  procedureName: string;
  name: string;
  query: string;
  definition: string;
}

interface StoredFunction {
  database: string;
  name: string;
  params: ProcedureParam[];
  body: string;
  definition: string;
}

interface TableColumnMeta {
  name: string;
  definition: string;
}

interface RebuildColumnSpec {
  name: string;
  definition: string;
  sourceName?: string;
}

export class SqlExecutor {
  private sqlModule: SqlJs | null = null;
  private databases = new Map<string, SqlJsDatabase>();
  private procedures = new Map<string, StoredProcedure>();
  private functions = new Map<string, StoredFunction>();
  private triggers = new Map<string, StoredTrigger>();
  private cursors = new Map<string, StoredCursor>();
  private activeDatabase = 'main';
  private users = new Map<string, DbUser>();
  private grants = new Map<string, GrantEntry[]>();
  private currentUserKey = 'admin@localhost';
  private readonly runtimeCursorScope = 'session';
  private lastRowCount = 0;

  private procedureKey(database: string, name: string): string {
    return `${database.toLowerCase()}.${name.toLowerCase()}`;
  }

  private functionKey(database: string, name: string): string {
    return `${database.toLowerCase()}.${name.toLowerCase()}`;
  }

  private triggerKey(database: string, name: string): string {
    return `${database.toLowerCase()}.${name.toLowerCase()}`;
  }

  private cursorKey(database: string, procedureName: string, cursorName: string): string {
    return `${database.toLowerCase()}.${procedureName.toLowerCase()}.${cursorName.toLowerCase()}`;
  }

  private registerRuntimeCursorMetadata(sql: string, database: string): void {
    const extracted = extractCursorDefinitions(sql);
    if (extracted.length === 0) return;

    for (const cursor of extracted) {
      this.cursors.set(this.cursorKey(database, this.runtimeCursorScope, cursor.name), {
        database,
        procedureName: this.runtimeCursorScope,
        name: cursor.name,
        query: cursor.query,
        definition: cursor.definition,
      });
    }
  }

  private parseQualifiedName(raw: string): { database?: string; name: string } | null {
    const cleaned = raw.trim().replace(/;$/, '');
    if (!cleaned) return null;

    const parts = cleaned
      .split('.')
      .map((part) => this.normalizeIdentifier(part))
      .filter(Boolean);

    if (parts.length === 1) {
      return { name: parts[0] };
    }
    if (parts.length === 2) {
      return { database: parts[0], name: parts[1] };
    }
    return null;
  }

  private parseCursorReference(
    raw: string,
  ): { database?: string; procedureName?: string; name: string } | null {
    const cleaned = raw.trim().replace(/;$/, '');
    if (!cleaned) return null;

    const parts = cleaned
      .split('.')
      .map((part) => this.normalizeIdentifier(part))
      .filter(Boolean);

    if (parts.length === 1) {
      return { name: parts[0] };
    }
    if (parts.length === 2) {
      return { procedureName: parts[0], name: parts[1] };
    }
    if (parts.length === 3) {
      return { database: parts[0], procedureName: parts[1], name: parts[2] };
    }

    return null;
  }

  private clearProcedureMetadata(database: string, procedureName: string): void {
    this.procedures.delete(this.procedureKey(database, procedureName));

    for (const key of Array.from(this.cursors.keys())) {
      if (key.startsWith(`${database.toLowerCase()}.${procedureName.toLowerCase()}.`)) {
        this.cursors.delete(key);
      }
    }
  }

  /**
   * Extract the body of a routine between the outermost BEGIN and END,
   * properly handling nested BEGIN/END, END IF, END LOOP etc.
   * Returns { preamble, body } where preamble is everything before BEGIN
   * and body is the content between the first top-level BEGIN and the matching END.
   */
  private extractRoutineBody(sql: string): { preamble: string; body: string } | null {
    // Find the first top-level BEGIN
    const beginRegex = /\bBEGIN\b/gi;
    let beginMatch: RegExpExecArray | null;
    let beginIdx = -1;

    while ((beginMatch = beginRegex.exec(sql)) !== null) {
      // Check it's not inside a string
      const before = sql.slice(0, beginMatch.index);
      const singleQuotes = (before.match(/'/g) || []).length;
      if (singleQuotes % 2 === 0) {
        beginIdx = beginMatch.index;
        break;
      }
    }

    if (beginIdx === -1) return null;

    const preamble = sql.slice(0, beginIdx).trim();
    const afterBegin = beginIdx + 5; // length of "BEGIN"
    let depth = 1;
    let i = afterBegin;
    let inSingle = false;
    let inDouble = false;

    while (i < sql.length && depth > 0) {
      const ch = sql[i];

      if (ch === "'" && !inDouble) { inSingle = !inSingle; i += 1; continue; }
      if (ch === '"' && !inSingle) { inDouble = !inDouble; i += 1; continue; }
      if (inSingle || inDouble) { i += 1; continue; }

      // Check for word boundaries for BEGIN/END
      if (/[A-Za-z_]/.test(ch)) {
        let wordEnd = i;
        while (wordEnd < sql.length && /[A-Za-z0-9_]/.test(sql[wordEnd])) wordEnd += 1;
        const word = sql.slice(i, wordEnd).toUpperCase();

        if (word === 'BEGIN') {
          depth += 1;
        } else if (word === 'END') {
          // Peek at next word to check for END IF / END LOOP / END CASE
          let peek = wordEnd;
          while (peek < sql.length && /\s/.test(sql[peek])) peek += 1;
          let nextWordEnd = peek;
          while (nextWordEnd < sql.length && /[A-Za-z0-9_]/.test(sql[nextWordEnd])) nextWordEnd += 1;
          const nextWord = sql.slice(peek, nextWordEnd).toUpperCase();

          if (nextWord === 'IF' || nextWord === 'LOOP' || nextWord === 'CASE' || nextWord === 'WHILE') {
            // END IF / END LOOP etc. — don't change depth
            i = nextWordEnd;
            continue;
          }

          depth -= 1;
          if (depth === 0) {
            const body = sql.slice(afterBegin, i).trim();
            return { preamble, body };
          }
        }
        i = wordEnd;
        continue;
      }

      i += 1;
    }

    return null;
  }

  private splitCommaSafe(raw: string): string[] {
    const out: string[] = [];
    let current = '';
    let depth = 0;
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];

      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
        current += ch;
        continue;
      }
      if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
        current += ch;
        continue;
      }

      if (!inSingle && !inDouble) {
        if (ch === '(') depth += 1;
        if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) {
          const piece = current.trim();
          if (piece) out.push(piece);
          current = '';
          continue;
        }
      }

      current += ch;
    }

    const tail = current.trim();
    if (tail) out.push(tail);
    return out;
  }

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private parseLeadingIdentifier(raw: string): { identifier: string; rest: string } | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    let match = trimmed.match(/^`([^`]+)`\s*([\s\S]*)$/);
    if (match) return { identifier: match[1], rest: match[2] ?? '' };

    match = trimmed.match(/^"([^"]+)"\s*([\s\S]*)$/);
    if (match) return { identifier: match[1], rest: match[2] ?? '' };

    match = trimmed.match(/^'([^']+)'\s*([\s\S]*)$/);
    if (match) return { identifier: match[1], rest: match[2] ?? '' };

    match = trimmed.match(/^([A-Za-z_][\w$]*)\s*([\s\S]*)$/);
    if (match) return { identifier: match[1], rest: match[2] ?? '' };

    return null;
  }

  private splitTopLevelComma(raw: string): string[] {
    const out: string[] = [];
    let current = '';
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inBacktick = false;

    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];

      if (ch === "'" && !inDouble && !inBacktick) {
        inSingle = !inSingle;
        current += ch;
        continue;
      }
      if (ch === '"' && !inSingle && !inBacktick) {
        inDouble = !inDouble;
        current += ch;
        continue;
      }
      if (ch === '`' && !inSingle && !inDouble) {
        inBacktick = !inBacktick;
        current += ch;
        continue;
      }

      if (!inSingle && !inDouble && !inBacktick) {
        if (ch === '(') depth += 1;
        if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) {
          const piece = current.trim();
          if (piece) out.push(piece);
          current = '';
          continue;
        }
      }

      current += ch;
    }

    const tail = current.trim();
    if (tail) out.push(tail);
    return out;
  }

  private buildColumnDefinitionFromPragma(row: unknown[]): string {
    const name = String(row[1] ?? '');
    const type = String(row[2] ?? 'TEXT').trim() || 'TEXT';
    const notNull = Number(row[3] ?? 0) === 1;
    const defaultValue = row[4];
    const primaryKey = Number(row[5] ?? 0) === 1;

    let definition = `${this.quoteIdentifier(name)} ${type}`;
    if (primaryKey) definition += ' PRIMARY KEY';
    if (notNull) definition += ' NOT NULL';
    if (defaultValue !== null && defaultValue !== undefined && String(defaultValue).trim() !== '') {
      definition += ` DEFAULT ${String(defaultValue)}`;
    }
    return definition;
  }

  private getTableColumnMeta(tableName: string): TableColumnMeta[] {
    const activeDb = this.getActiveDb();
    if (!activeDb) return [];

    const pragma = activeDb.exec(`PRAGMA table_info(${this.quoteIdentifier(tableName)})`);
    if (pragma.length === 0 || pragma[0].values.length === 0) return [];

    return pragma[0].values.map((row) => ({
      name: String(row[1] ?? ''),
      definition: this.buildColumnDefinitionFromPragma(row),
    }));
  }

  private normalizeAlterColumnDefinition(rawDefinition: string): string {
    const activeDb = this.getActiveDb();
    if (!activeDb) return rawDefinition.trim();

    const dummy = `CREATE TABLE __qc_alter_norm (${rawDefinition.trim()})`;
    const translated = translateMySQL(
      dummy,
      activeDb,
      this.activeDatabase,
      this.getCurrentUserDisplay(),
    ).sql;

    if (!translated) return rawDefinition.trim();
    const m = translated.match(/^CREATE\s+TABLE\s+__qc_alter_norm\s*\(([^]*)\)$/i);
    return (m?.[1] ?? rawDefinition).trim();
  }

  private rebuildTableWithSpec(
    tableName: string,
    columns: RebuildColumnSpec[],
    rawSql: string,
    startTime: number,
  ): QueryResult {
    const activeDb = this.getActiveDb();
    if (!activeDb) {
      return sqlErrorEngine.fromMessage('Database not initialized. Call init() first.', {
        sql: rawSql,
        startTime,
      });
    }

    const oldTableSql = this.quoteIdentifier(tableName);
    const tempTable = `__qc_tmp_${tableName}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const tempTableSql = this.quoteIdentifier(tempTable);

    const definitions = columns.map((column) => column.definition.trim());
    const insertColumns: string[] = [];
    const selectColumns: string[] = [];
    for (const column of columns) {
      if (!column.sourceName) continue;
      insertColumns.push(this.quoteIdentifier(column.name));
      selectColumns.push(this.quoteIdentifier(column.sourceName));
    }

    try {
      activeDb.run('BEGIN');
      activeDb.run(`CREATE TABLE ${tempTableSql} (${definitions.join(', ')})`);
      if (insertColumns.length > 0) {
        activeDb.run(
          `INSERT INTO ${tempTableSql} (${insertColumns.join(', ')}) SELECT ${selectColumns.join(', ')} FROM ${oldTableSql}`,
        );
      }
      activeDb.run(`DROP TABLE ${oldTableSql}`);
      activeDb.run(`ALTER TABLE ${tempTableSql} RENAME TO ${oldTableSql}`);
      activeDb.run('COMMIT');

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    } catch (error) {
      try {
        activeDb.run('ROLLBACK');
      } catch {
        // ignore rollback failure
      }

      return sqlErrorEngine.fromUnknownError(error, {
        sql: rawSql,
        startTime,
      });
    }
  }

  private replaceLeadingIdentifier(definition: string, nextName: string): string {
    const parsed = this.parseLeadingIdentifier(definition);
    if (!parsed) return definition;
    return `${this.quoteIdentifier(nextName)} ${parsed.rest.trim()}`.trim();
  }

  private handleAlterTableCompatibility(rawSql: string, startTime: number): QueryResult | null {
    return handleAlterTableCompatibilityExternal.call(
      this as unknown as AlterTableCompatibilityContext,
      rawSql,
      startTime,
    );
  }


  private parseProcedureParams(raw: string): ProcedureParam[] {
    const source = raw.trim();
    if (!source) return [];

    return this.splitCommaSafe(source)
      .map((token) => {
        const normalized = token.trim().replace(/\s+/g, ' ');
        if (!normalized) return null;

        const match = normalized.match(/^(?:(IN|OUT|INOUT)\s+)?([A-Za-z_][\w$]*)(?:\s+.+)?$/i);
        if (!match) return null;

        const mode = (match[1]?.toUpperCase() ?? 'IN') as 'IN' | 'OUT' | 'INOUT';
        const name = match[2];
        return { name, mode } satisfies ProcedureParam;
      })
      .filter((param): param is ProcedureParam => param !== null);
  }

  private toSqlLiteral(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return 'NULL';
    if (/^null$/i.test(trimmed)) return 'NULL';
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return trimmed;
    if (/^'.*'$/.test(trimmed)) return trimmed;
    if (/^".*"$/.test(trimmed)) {
      return `'${trimmed.slice(1, -1).replace(/'/g, "''")}'`;
    }
    return `'${trimmed.replace(/'/g, "''")}'`;
  }

  private substituteProcedureParams(
    body: string,
    params: ProcedureParam[],
    args: string[],
  ): { sql: string; error?: string } {
    const replacements = new Map<string, string>();

    for (let i = 0; i < params.length; i += 1) {
      const param = params[i];
      if (!param) continue;

      if (param.mode !== 'IN') {
        return {
          sql: '',
          error: `Procedure parameter mode '${param.mode}' is not supported yet. Use IN parameters only.`,
        };
      }

      const argSql = this.toSqlLiteral(args[i] ?? 'NULL');
      replacements.set(param.name.toLowerCase(), argSql);
    }

    return { sql: replaceSqlIdentifiers(body, replacements) };
  }

  private executeStoredProcedure(
    procedure: StoredProcedure,
    argsRaw: string,
    startTime: number,
    rawSql: string,
  ): QueryResult {
    if (!this.hasPrivilege('EXECUTE', procedure.database)) {
      return sqlErrorEngine.fromMessage(
        `Access denied for user '${this.getCurrentUserDisplay()}' to EXECUTE procedure '${procedure.name}'`,
        {
          sql: rawSql,
          startTime,
        },
      );
    }

    const args = argsRaw.trim() ? this.splitCommaSafe(argsRaw) : [];
    if (args.length !== procedure.params.length) {
      return sqlErrorEngine.fromMessage(
        `Procedure '${procedure.name}' expects ${procedure.params.length} argument(s) but received ${args.length}`,
        {
          sql: rawSql,
          startTime,
        },
      );
    }

    const substituted = this.substituteProcedureParams(procedure.body, procedure.params, args);
    if (substituted.error) {
      return sqlErrorEngine.fromMessage(substituted.error, {
        sql: rawSql,
        startTime,
      });
    }

    const previousDb = this.activeDatabase;
    const switched = this.useDatabase(procedure.database);
    if (switched.error) {
      return switched;
    }

    try {
      const result = this.execute(`BEGIN ${substituted.sql.trim()} END;`);
      return {
        ...result,
        executionTimeMs: performance.now() - startTime,
      };
    } finally {
      this.useDatabase(previousDb);
    }
  }

  private evaluateStoredFunction(fn: StoredFunction, args: string[]): { value: unknown; error?: string } {
    if (args.length !== fn.params.length) {
      return { value: null, error: `Function '${fn.name}' expects ${fn.params.length} argument(s) but received ${args.length}` };
    }

    const substituted = this.substituteProcedureParams(fn.body, fn.params, args);
    if (substituted.error) {
      return { value: null, error: substituted.error };
    }

    const previousDb = this.activeDatabase;
    const switched = this.useDatabase(fn.database);
    if (switched.error) {
      return { value: null, error: switched.error };
    }

    try {
      const blockSql = `BEGIN ${substituted.sql.trim()} END;`;
      const result = runPlSqlBlock(blockSql, {
        executeSql: (sql) => this.execute(sql),
      });
      if (result.error) {
        return { value: null, error: result.error };
      }
      if (result.returnValue !== undefined) {
        return { value: result.returnValue };
      }
      // If no RETURN was executed, look for a result row
      if (result.rows.length > 0) {
        const firstVal = Object.values(result.rows[0])[0];
        return { value: firstVal ?? null };
      }
      return { value: null };
    } finally {
      this.useDatabase(previousDb);
    }
  }

  private substituteUserFunctionCalls(sql: string): string {
    if (this.functions.size === 0) return sql;

    const fnNames = Array.from(this.functions.values())
      .filter((fn) => fn.database === this.activeDatabase)
      .map((fn) => fn.name);
    if (fnNames.length === 0) return sql;

    const pattern = new RegExp(`\\b(${fnNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*\\(`, 'gi');

    let output = '';
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(sql)) !== null) {
      const fnName = match[1];
      const fnStart = match.index;
      const openParen = pattern.lastIndex - 1;
      let depth = 1;
      let i = openParen + 1;
      let inSingle = false;
      let inDouble = false;

      for (; i < sql.length; i += 1) {
        const ch = sql[i];
        if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
        if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
        if (inSingle || inDouble) continue;
        if (ch === '(') depth += 1;
        if (ch === ')') { depth -= 1; if (depth === 0) break; }
      }

      if (depth !== 0) break;

      const argsStr = sql.slice(openParen + 1, i).trim();
      const args = argsStr ? this.splitCommaSafe(argsStr) : [];
      const fn = this.functions.get(this.functionKey(this.activeDatabase, fnName));
      if (!fn) {
        output += sql.slice(cursor, i + 1);
        cursor = i + 1;
        pattern.lastIndex = cursor;
        continue;
      }

      const evaluated = this.evaluateStoredFunction(fn, args);
      if (evaluated.error) {
        // Can't inline — leave call as-is (it will error at SQLite level)
        output += sql.slice(cursor, i + 1);
      } else {
        output += sql.slice(cursor, fnStart);
        output += this.toSqlLiteral(evaluated.value === null || evaluated.value === undefined ? 'NULL' : String(evaluated.value));
      }
      cursor = i + 1;
      pattern.lastIndex = cursor;
    }

    return output + sql.slice(cursor);
  }

  private userKey(username: string, host = 'localhost'): string {
    return `${username}@${host}`.toLowerCase();
  }

  private normalizeIdentifier(raw: string): string {
    const value = raw.trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('`') && value.endsWith('`'))
    ) {
      return value.slice(1, -1);
    }
    return value;
  }

  private parseUserSpec(raw: string): { username: string; host: string } | null {
    const spec = raw.trim().replace(/;$/, '');
    if (!spec) return null;

    const parts = spec
      .split('@')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0 || parts.length > 2) return null;

    const username = this.normalizeIdentifier(parts[0]);
    const host = this.normalizeIdentifier(parts[1] ?? 'localhost');
    if (!username || !host) return null;
    return { username, host };
  }

  private formatUser(user: { username: string; host: string }): string {
    return `'${user.username}'@'${user.host}'`;
  }

  private displayUser(user: { username: string; host: string }): string {
    return user.host.toLowerCase() === 'localhost'
      ? user.username
      : `${user.username}@${user.host}`;
  }

  private getCurrentUser(): DbUser {
    return this.users.get(this.currentUserKey) ?? { username: 'admin', host: 'localhost' };
  }

  getCurrentUserDisplay(): string {
    const current = this.getCurrentUser();
    return `${current.username}@${current.host}`;
  }

  private isCurrentUserAdmin(): boolean {
    const current = this.getCurrentUser();
    return current.username.toLowerCase() === 'admin';
  }

  private normalizePrivilegeToken(raw: string): SupportedPrivilege | null {
    const token = raw.trim().toUpperCase().replace(/\s+/g, ' ');
    const mapped = token === 'ALL' ? 'ALL PRIVILEGES' : token;
    return SUPPORTED_PRIVILEGES.has(mapped as SupportedPrivilege)
      ? (mapped as SupportedPrivilege)
      : null;
  }

  private splitCommaSeparated(raw: string): string[] {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private parseGrantScope(raw: string): { database: string; table: string } | null {
    const cleaned = raw.trim();
    const scopeMatch = cleaned.match(/^(.+?)\.(.+)$/);
    if (scopeMatch) {
      const database = this.normalizeIdentifier(scopeMatch[1]);
      const table = this.normalizeIdentifier(scopeMatch[2]);
      if (!database || !table) return null;
      // *  in db position means global; normalise to '*'
      return { database: database === '*' ? '*' : database, table };
    }

    // No dot: bare table name or bare '*' — scope to the active database (MySQL behaviour)
    const identifier = this.normalizeIdentifier(cleaned);
    if (!identifier) return null;
    return { database: this.activeDatabase, table: identifier };
  }

  private getGrantEntries(userKey: string): GrantEntry[] {
    return this.grants.get(userKey) ?? [];
  }

  private setGrantEntries(userKey: string, entries: GrantEntry[]): void {
    this.grants.set(userKey, entries);
  }

  private upsertGrant(
    userKey: string,
    scope: { database: string; table: string },
    privileges: SupportedPrivilege[],
    withGrantOption: boolean,
  ): void {
    const entries = this.getGrantEntries(userKey);
    const existing = entries.find(
      (entry) =>
        entry.database.toLowerCase() === scope.database.toLowerCase() &&
        entry.table.toLowerCase() === scope.table.toLowerCase(),
    );

    if (existing) {
      for (const privilege of privileges) {
        existing.privileges.add(privilege);
      }
      existing.withGrantOption = existing.withGrantOption || withGrantOption;
      this.setGrantEntries(userKey, entries);
      return;
    }

    entries.push({
      database: scope.database,
      table: scope.table,
      privileges: new Set(privileges),
      withGrantOption,
    });
    this.setGrantEntries(userKey, entries);
  }

  private revokeGrant(
    userKey: string,
    scope: { database: string; table: string },
    privileges: SupportedPrivilege[],
  ): void {
    const entries = this.getGrantEntries(userKey);
    const nextEntries: GrantEntry[] = [];

    for (const entry of entries) {
      const sameScope =
        entry.database.toLowerCase() === scope.database.toLowerCase() &&
        entry.table.toLowerCase() === scope.table.toLowerCase();

      if (!sameScope) {
        nextEntries.push(entry);
        continue;
      }

      if (entry.privileges.has('ALL PRIVILEGES')) {
        if (privileges.includes('ALL PRIVILEGES')) {
          continue;
        }
        entry.privileges.delete('ALL PRIVILEGES');
        SUPPORTED_PRIVILEGES.forEach((privilege) => {
          if (privilege !== 'ALL PRIVILEGES') {
            entry.privileges.add(privilege);
          }
        });
      }

      for (const privilege of privileges) {
        if (privilege === 'ALL PRIVILEGES') {
          entry.privileges.clear();
          break;
        }
        entry.privileges.delete(privilege);
      }

      if (entry.privileges.size > 0) {
        nextEntries.push(entry);
      }
    }

    this.setGrantEntries(userKey, nextEntries);
  }

  private requiredPrivilegeForSql(sql: string): SupportedPrivilege | null {
    const cleaned = stripComments(sql);
    if (!cleaned.trim()) return null;

    const leadingVerb = extractLeadingSqlVerb(cleaned);
    if (!leadingVerb) return null;

    if (['SELECT', 'SHOW', 'DESC', 'DESCRIBE', 'EXPLAIN'].includes(leadingVerb)) {
      return 'SELECT';
    }
    if (leadingVerb === 'INSERT' || leadingVerb === 'REPLACE') return 'INSERT';
    if (leadingVerb === 'UPDATE') return 'UPDATE';
    if (leadingVerb === 'DELETE' || leadingVerb === 'TRUNCATE') return 'DELETE';
    if (leadingVerb === 'CALL') return 'EXECUTE';
    if (leadingVerb === 'ALTER') return 'ALTER';
    if (leadingVerb === 'DROP' || leadingVerb === 'RENAME') return 'DROP';

    if (leadingVerb === 'CREATE') {
      const norm = cleaned.replace(/\s+/g, ' ').trim().toUpperCase();
      if (/^CREATE\s+INDEX\b/.test(norm)) return 'INDEX';
      return 'CREATE';
    }

    return null;
  }

  private hasPrivilege(privilege: SupportedPrivilege, database: string, table?: string): boolean {
    if (this.isCurrentUserAdmin()) return true;

    const userEntries = this.getGrantEntries(this.currentUserKey);
    const dbLower = database.toLowerCase();
    for (const entry of userEntries) {
      const dbMatches = entry.database === '*' || entry.database.toLowerCase() === dbLower;
      if (!dbMatches) continue;

      // table='*' covers all tables; a specific table name matches either exactly or when the
      // caller passes the target table name explicitly.
      const tableMatches =
        entry.table === '*' ||
        (table !== undefined && entry.table.toLowerCase() === table.toLowerCase());

      if (!tableMatches) continue;

      if (entry.privileges.has('ALL PRIVILEGES') || entry.privileges.has(privilege)) {
        return true;
      }
    }

    return false;
  }

  private extractPrivilegeTargets(
    sql: string,
  ): Array<{ privilege: SupportedPrivilege; database: string; table?: string }> {
    const deduped = new Map<
      string,
      { privilege: SupportedPrivilege; database: string; table?: string }
    >();

    const addTarget = (target: { privilege: SupportedPrivilege; database: string; table?: string }) => {
      const key = `${target.privilege}:${target.database.toLowerCase()}.${target.table?.toLowerCase() ?? '*'}`;
      if (deduped.has(key)) return;
      deduped.set(key, target);
    };

    const tableTargets = extractPrivilegeTableTargets(sql);
    for (const tableTarget of tableTargets) {
      const resolvedDb = tableTarget.database
        ? (this.resolveDatabaseName(tableTarget.database) ?? tableTarget.database)
        : this.activeDatabase;

      addTarget({
        privilege: tableTarget.privilege,
        database: resolvedDb,
        table: tableTarget.table,
      });
    }

    if (tableTargets.length > 0) {
      return Array.from(deduped.values());
    }

    const required = this.requiredPrivilegeForSql(sql);
    if (!required) {
      return [];
    }

    addTarget({ privilege: required, database: this.activeDatabase });
    return Array.from(deduped.values());
  }

  private denyIfNoPrivilege(sql: string, startTime: number): QueryResult | null {
    const targets = this.extractPrivilegeTargets(sql);
    for (const target of targets) {
      if (this.hasPrivilege(target.privilege, target.database, target.table)) {
        continue;
      }

      const scope = target.table
        ? `${target.database}.${target.table}`
        : `database '${target.database}'`;

      return sqlErrorEngine.fromMessage(
        `Access denied for user '${this.getCurrentUserDisplay()}' to ${target.privilege} on ${scope}`,
        {
          sql,
          startTime,
        },
      );
    }

    return null;
  }

  private getActiveDb(): SqlJsDatabase | null {
    return this.databases.get(this.activeDatabase) ?? null;
  }

  private listDatabases(): string[] {
    return Array.from(this.databases.keys()).sort((a, b) => a.localeCompare(b));
  }

  private resolveDatabaseName(name: string): string | undefined {
    const direct = this.databases.has(name) ? name : undefined;
    if (direct) return direct;

    const lower = name.toLowerCase();
    return this.listDatabases().find((dbName) => dbName.toLowerCase() === lower);
  }

  private handleDatabaseCommand(rawSql: string, startTime: number): QueryResult | null {
    return handleDatabaseCommandExternal.call(
      this as unknown as DatabaseCommandContext,
      rawSql,
      startTime,
    );
  }


  async init(): Promise<void> {
    const SQL = await loadSqlJs();
    this.sqlModule = SQL;
    this.databases.clear();
    this.procedures.clear();
    this.functions.clear();
    this.triggers.clear();
    this.cursors.clear();
    this.lastRowCount = 0;
    const mainDb = new SQL.Database();
    mainDb.run('PRAGMA foreign_keys = ON;');
    this.databases.set('main', mainDb);
    this.activeDatabase = 'main';

    this.users.clear();
    this.grants.clear();
    const admin: DbUser = { username: 'admin', host: 'localhost' };
    const adminKey = this.userKey(admin.username, admin.host);
    this.users.set(adminKey, admin);
    this.grants.set(adminKey, [
      {
        database: '*',
        table: '*',
        privileges: new Set<SupportedPrivilege>(['ALL PRIVILEGES']),
        withGrantOption: true,
      },
    ]);
    this.currentUserKey = adminKey;
  }

  isReady(): boolean {
    return this.getActiveDb() !== null;
  }

  getActiveDatabase(): string {
    return this.activeDatabase;
  }

  getDatabases(): string[] {
    return this.listDatabases();
  }

  getUsers(): string[] {
    return Array.from(this.users.values())
      .sort((a, b) => this.displayUser(a).localeCompare(this.displayUser(b)))
      .map((user) => this.displayUser(user));
  }

  useUser(name: string): QueryResult {
    const parsed = this.parseUserSpec(name);
    if (!parsed) {
      return sqlErrorEngine.fromMessage(`Invalid user '${name}'`, {
        sql: `SET USER ${name}`,
        startTime: performance.now(),
      });
    }
    return this.execute(`SET USER ${this.formatUser(parsed)}`);
  }

  useDatabase(name: string): QueryResult {
    return this.execute(`USE "${name}"`);
  }

  execute(sql: string): QueryResult {
    const start = performance.now();

    const activeDb = this.getActiveDb();
    if (!activeDb) {
      return sqlErrorEngine.fromMessage('Database not initialized. Call init() first.', {
        sql,
        startTime: start,
      });
    }

    const normalizedSql = sql.trim();

    if (isPlSqlBlock(normalizedSql)) {
      this.registerRuntimeCursorMetadata(normalizedSql, this.activeDatabase);

      const plSqlResult = runPlSqlBlock(normalizedSql, {
        executeSql: (statement) => this.execute(statement),
      });

      if (plSqlResult.error) {
        return sqlErrorEngine.enrichResultWithError(plSqlResult, {
          sql,
        });
      }

      return {
        ...plSqlResult,
        executionTimeMs:
          plSqlResult.executionTimeMs > 0 ? plSqlResult.executionTimeMs : performance.now() - start,
      };
    }

    const virtualResult = this.handleDatabaseCommand(normalizedSql, start);
    if (virtualResult) return virtualResult;

    const permissionError = this.denyIfNoPrivilege(normalizedSql, start);
    if (permissionError) return permissionError;

    const alterCompatibility = this.handleAlterTableCompatibility(normalizedSql, start);
    if (alterCompatibility) return alterCompatibility;

    // Rewrite DML targeting views (UPDATE/DELETE/INSERT on simple single-table views)
    {
      const upperTrimmed = normalizedSql.replace(/\s+/g, ' ').trim().toUpperCase();
      if (/^UPDATE\b/.test(upperTrimmed)) {
        const rewritten = rewriteViewUpdate(activeDb, normalizedSql);
        if (rewritten) return this.execute(rewritten);
      } else if (/^DELETE\b/.test(upperTrimmed)) {
        const rewritten = rewriteViewDelete(activeDb, normalizedSql);
        if (rewritten) return this.execute(rewritten);
      } else if (/^INSERT\b/.test(upperTrimmed)) {
        const rewritten = rewriteViewInsert(activeDb, normalizedSql);
        if (rewritten) return this.execute(rewritten);
      }
    }

    // Run MySQL translation
    const translated = translateMySQL(
      normalizedSql,
      activeDb,
      this.activeDatabase,
      this.getCurrentUserDisplay(),
    );

    // If translation produced a pre-computed result, return it with timing
    if (translated.sql === null && translated.result) {
      const resolved = { ...translated.result, executionTimeMs: performance.now() - start };
      if (!resolved.error) return resolved;

      return sqlErrorEngine.enrichResultWithError(resolved, {
        sql,
        translatedSql: translated.sql ?? undefined,
      });
    }

    let finalSql = translated.sql ?? normalizedSql;

    // Substitute ROW_COUNT() with the last tracked row count
    finalSql = finalSql.replace(/\bROW_COUNT\s*\(\s*\)/gi, String(this.lastRowCount));

    // Substitute user-defined function calls in the SQL
    finalSql = this.substituteUserFunctionCalls(finalSql);

    try {
      const results = activeDb.exec(finalSql);
      const elapsed = performance.now() - start;

      if (results.length === 0) {
        const normalizedFinalSql = finalSql.trim().toUpperCase();
        const isReadQuery = /^(SELECT|WITH|PRAGMA|EXPLAIN)/.test(normalizedFinalSql);
        if (isReadQuery) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: elapsed,
          };
        }

        const rowsModified = activeDb.getRowsModified();
        this.lastRowCount = rowsModified;
        return {
          columns: [],
          rows: [],
          rowCount: rowsModified,
          executionTimeMs: elapsed,
        };
      }

      const { columns: rawColumns, values } = results[0];
      // Rename columns that are expanded aggregate formulas back to their original MySQL call form
      const renames = translated.columnRenames ?? {};
      const columns = rawColumns.map((col) => renames[col] ?? col);
      const rows: Row[] = values.map((vals) => {
        const row: Row = {};
        columns.forEach((col, i) => {
          row[col] = vals[i];
        });
        return row;
      });

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: elapsed,
      };
    } catch (e) {
      return sqlErrorEngine.fromUnknownError(e, {
        sql,
        translatedSql: finalSql,
        startTime: start,
      });
    }
  }

  getTables(): TableSchema[] {
    const activeDb = this.getActiveDb();
    if (!activeDb) return [];

    const result = activeDb.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    if (result.length === 0) return [];

    return result[0].values.map(([tableName]) => {
      const name = String(tableName);
      const pragmaResult = activeDb.exec(`PRAGMA table_info("${name}")`);
      const fkResult = activeDb.exec(`PRAGMA foreign_key_list("${name}")`);

      const fks: Record<string, { table: string; column: string }> = {};
      if (fkResult.length > 0) {
        for (const row of fkResult[0].values) {
          const fromCol = String(row[3]);
          const toTable = String(row[2]);
          const toCol = String(row[4]);
          fks[fromCol] = { table: toTable, column: toCol };
        }
      }

      const columns =
        pragmaResult.length > 0
          ? pragmaResult[0].values.map((row) => {
              const colName = String(row[1]);
              return {
                name: colName,
                type: String(row[2]),
                nullable: row[3] === 0,
                primaryKey: row[5] === 1,
                foreignKey: fks[colName],
              };
            })
          : [];

      return { name, columns };
    });
  }

  loadSQL(sql: string): QueryResult {
    const statements = splitSqlStatements(sql);
    if (statements.length === 0) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
      };
    }

    let finalResult: QueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
    };
    const statementResults: StatementQueryResult[] = [];

    for (const statement of statements) {
      const result = this.execute(statement);
      finalResult = result;
      statementResults.push({
        statement,
        database: this.activeDatabase,
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs,
        error: result.error,
        errorDetails: result.errorDetails,
      });

      if (result.error) {
        return {
          ...result,
          statementResults,
        };
      }
    }

    return {
      ...finalResult,
      statementResults,
    };
  }

  reset(): void {
    for (const db of this.databases.values()) {
      db.close();
    }
    this.databases.clear();
    this.procedures.clear();
    this.functions.clear();
    this.triggers.clear();
    this.cursors.clear();
    this.lastRowCount = 0;
    this.sqlModule = null;
    this.activeDatabase = 'main';
    this.users.clear();
    this.grants.clear();
    this.currentUserKey = this.userKey('admin', 'localhost');
    resetSqlJsLoader();
  }

  exportCSV(result: QueryResult): string {
    if (result.columns.length === 0) return '';
    const header = result.columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
    const rows = result.rows.map((row) =>
      result.columns
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    return [header, ...rows].join('\n');
  }
}
