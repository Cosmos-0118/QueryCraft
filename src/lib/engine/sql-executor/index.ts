import type { QueryResult, StatementQueryResult, TableSchema, Row } from '@/types/database';
import { sqlErrorEngine } from '@/lib/engine/sql-error-engine';
import { loadSqlJs, resetSqlJsLoader } from './sqljs-loader';
import { stripComments } from './utils';
import { translateMySQL } from './translation';
import { splitSqlStatements } from './statement-splitter';
import { isPlSqlBlock, runPlSqlBlock } from './plsql-runtime';
import { extractCursorDefinitions } from './mysql-compat';
import { rewriteViewUpdate, rewriteViewDelete, rewriteViewInsert } from './view-manager';
import {
  extractLeadingSqlVerb,
  extractPrivilegeTableTargets,
  replaceSqlIdentifiers,
  transformSqlCodeSegments,
} from './sql-lexer';
import {
  escapeRegex,
  extractRoutineBody as extractRoutineBodyHelper,
  parseCreateTableMeta,
  parseLeadingIdentifier,
  parseProcedureParams,
  quoteSqlLiteral,
  replaceLeadingIdentifier,
  rewriteSchemaSqlIdentifiers,
  splitCommaSafe,
  sqlReferencesIdentifier,
  splitTopLevelComma,
  toSqlLiteral,
  type ParsedCreateTableMeta,
  type ProcedureParam,
  type RebuildColumnSpec,
  type TableColumnMeta,
} from './sql-structure-utils';
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

interface SchemaObjectSnapshot {
  type: 'index' | 'trigger';
  name: string;
  sql: string;
}

interface UnsupportedMySqlPattern {
  pattern: RegExp;
  reason: string;
}

const SQLITE_EXECUTABLE_VERBS = new Set([
  'ALTER',
  'ANALYZE',
  'ATTACH',
  'BEGIN',
  'COMMIT',
  'CREATE',
  'DELETE',
  'DETACH',
  'DROP',
  'EXPLAIN',
  'INSERT',
  'PRAGMA',
  'REINDEX',
  'RELEASE',
  'RENAME',
  'REPLACE',
  'ROLLBACK',
  'SAVEPOINT',
  'SELECT',
  'START',
  'UPDATE',
  'VACUUM',
  'VALUES',
  'WITH',
]);

const PRIVILEGE_EXEMPT_VERBS = new Set([
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'SAVEPOINT',
  'RELEASE',
  'START',
  'SET',
  'USE',
]);

const UNSUPPORTED_MYSQL_PATTERNS: UnsupportedMySqlPattern[] = [
  {
    pattern: /^LOAD\s+(?:DATA|XML)\b/i,
    reason: 'Bulk file import commands require filesystem and server-side MySQL capabilities.',
  },
  {
    pattern: /^HANDLER\b/i,
    reason: 'HANDLER statements depend on MySQL storage-engine cursor internals.',
  },
  {
    pattern: /^XA\b/i,
    reason: 'XA distributed transaction commands are not available in the SQLite runtime.',
  },
  {
    pattern: /^(?:START|STOP)\s+(?:SLAVE|REPLICA)\b/i,
    reason: 'Replication control commands require a real MySQL replication server.',
  },
  {
    pattern: /^CHANGE\s+(?:MASTER|REPLICATION\s+SOURCE)\b/i,
    reason: 'Replication source configuration commands require a real MySQL server.',
  },
  {
    pattern: /^RESET\s+(?:MASTER|SLAVE|REPLICA)\b/i,
    reason: 'Replication reset commands are server-level MySQL operations.',
  },
  {
    pattern: /^LOCK\s+INSTANCE\b/i,
    reason: 'Instance lock commands require server-level MySQL locking.',
  },
  {
    pattern: /^UNLOCK\s+INSTANCE\b/i,
    reason: 'Instance unlock commands require server-level MySQL locking.',
  },
  {
    pattern: /^BINLOG\b/i,
    reason: 'BINLOG commands require MySQL binary log infrastructure.',
  },
  {
    pattern: /^(?:INSTALL|UNINSTALL)\s+PLUGIN\b/i,
    reason: 'Plugin management requires a server process and plugin subsystem.',
  },
  {
    pattern: /^SHUTDOWN\b/i,
    reason: 'SHUTDOWN is a server control command and is not supported in embedded mode.',
  },
  {
    pattern: /^CLONE\b/i,
    reason: 'CLONE requires MySQL server-side clone plugin support.',
  },
];

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
  private preparedStatements = new Map<string, string>();
  private sessionVariables = new Map<string, string>();

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
    return extractRoutineBodyHelper(sql);
  }

  private splitCommaSafe(raw: string): string[] {
    return splitCommaSafe(raw);
  }

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private parseLeadingIdentifier(raw: string): { identifier: string; rest: string } | null {
    return parseLeadingIdentifier(raw);
  }

  private splitTopLevelComma(raw: string): string[] {
    return splitTopLevelComma(raw);
  }

  private escapeRegex(value: string): string {
    return escapeRegex(value);
  }

  private quoteSqlLiteral(value: string): string {
    return quoteSqlLiteral(value);
  }

  private parseCreateTableMeta(createTableSql: string): ParsedCreateTableMeta | null {
    return parseCreateTableMeta(createTableSql);
  }

  private getCreateTableMeta(tableName: string): ParsedCreateTableMeta | null {
    const activeDb = this.getActiveDb();
    if (!activeDb) return null;

    const rows = activeDb.exec(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(${this.quoteSqlLiteral(tableName)}) LIMIT 1`,
    );
    if (rows.length === 0 || rows[0].values.length === 0) return null;

    const rawSql = String(rows[0].values[0]?.[0] ?? '').trim();
    if (!rawSql) return null;

    return this.parseCreateTableMeta(rawSql);
  }

  private buildColumnRenameMap(columns: RebuildColumnSpec[]): Map<string, string> {
    const replacements = new Map<string, string>();
    for (const column of columns) {
      if (!column.sourceName) continue;
      replacements.set(column.sourceName.toLowerCase(), column.name);
    }
    return replacements;
  }

  private extractDroppedColumnNames(tableName: string, columns: RebuildColumnSpec[]): Set<string> {
    const retainedSourceNames = new Set(
      columns
        .map((column) => column.sourceName?.toLowerCase())
        .filter((name): name is string => Boolean(name)),
    );

    const existingNames = this.getTableColumnMeta(tableName).map((column) => column.name.toLowerCase());
    return new Set(existingNames.filter((name) => !retainedSourceNames.has(name)));
  }

  private rewriteSchemaSqlIdentifiers(sql: string, replacements: ReadonlyMap<string, string>): string {
    return rewriteSchemaSqlIdentifiers(sql, replacements);
  }

  private sqlReferencesIdentifier(sql: string, identifier: string): boolean {
    return sqlReferencesIdentifier(sql, identifier);
  }

  private captureTableSchemaObjects(tableName: string): SchemaObjectSnapshot[] {
    const activeDb = this.getActiveDb();
    if (!activeDb) return [];

    const rows = activeDb.exec(
      `SELECT type, name, sql FROM sqlite_master WHERE lower(tbl_name) = lower(${this.quoteSqlLiteral(tableName)}) AND type IN ('index', 'trigger') AND sql IS NOT NULL ORDER BY type, name`,
    );
    if (rows.length === 0 || rows[0].values.length === 0) return [];

    return rows[0].values
      .map((row): SchemaObjectSnapshot | null => {
        const type = String(row[0] ?? '').toLowerCase();
        const name = String(row[1] ?? '').trim();
        const sql = String(row[2] ?? '').trim();
        if ((type !== 'index' && type !== 'trigger') || !name || !sql) {
          return null;
        }
        return {
          type,
          name,
          sql,
        };
      })
      .filter((snapshot): snapshot is SchemaObjectSnapshot => snapshot !== null);
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
    const parsed = this.getCreateTableMeta(tableName);
    if (parsed && parsed.columns.length > 0) {
      return parsed.columns;
    }

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

    const createTableMeta = this.getCreateTableMeta(tableName);
    const renameMap = this.buildColumnRenameMap(columns);
    const droppedColumnNames = this.extractDroppedColumnNames(tableName, columns);
    const droppedColumns = Array.from(droppedColumnNames);
    const schemaObjects = this.captureTableSchemaObjects(tableName);

    const rewrittenConstraints = (createTableMeta?.tableConstraints ?? [])
      .map((constraint) => this.rewriteSchemaSqlIdentifiers(constraint, renameMap))
      .filter(
        (constraint) =>
          !droppedColumns.some((columnName) => this.sqlReferencesIdentifier(constraint, columnName)),
      );

    const definitions = [...columns.map((column) => column.definition.trim()), ...rewrittenConstraints];
    const trailingClause = createTableMeta?.trailingClause ? ` ${createTableMeta.trailingClause}` : '';
    const insertColumns: string[] = [];
    const selectColumns: string[] = [];
    for (const column of columns) {
      if (!column.sourceName) continue;
      insertColumns.push(this.quoteIdentifier(column.name));
      selectColumns.push(this.quoteIdentifier(column.sourceName));
    }

    try {
      activeDb.run('BEGIN');
      activeDb.run(`CREATE TABLE ${tempTableSql} (${definitions.join(', ')})${trailingClause}`);
      if (insertColumns.length > 0) {
        activeDb.run(
          `INSERT INTO ${tempTableSql} (${insertColumns.join(', ')}) SELECT ${selectColumns.join(', ')} FROM ${oldTableSql}`,
        );
      }
      activeDb.run(`DROP TABLE ${oldTableSql}`);
      activeDb.run(`ALTER TABLE ${tempTableSql} RENAME TO ${oldTableSql}`);

      for (const object of schemaObjects) {
        if (droppedColumns.some((columnName) => this.sqlReferencesIdentifier(object.sql, columnName))) {
          continue;
        }

        const rewrittenObjectSql = this.rewriteSchemaSqlIdentifiers(object.sql, renameMap);
        if (
          droppedColumns.some((columnName) => this.sqlReferencesIdentifier(rewrittenObjectSql, columnName))
        ) {
          continue;
        }

        activeDb.run(rewrittenObjectSql);
      }

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
    return replaceLeadingIdentifier(definition, nextName, (identifier) => this.quoteIdentifier(identifier));
  }

  private handleAlterTableCompatibility(rawSql: string, startTime: number): QueryResult | null {
    return handleAlterTableCompatibilityExternal.call(
      this as unknown as AlterTableCompatibilityContext,
      rawSql,
      startTime,
    );
  }


  private parseProcedureParams(raw: string): ProcedureParam[] {
    return parseProcedureParams(raw);
  }

  private toSqlLiteral(value: string): string {
    return toSqlLiteral(value);
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

  private parseSetUserVariableAssignments(
    rawAssignments: string,
  ): Array<{ name: string; valueSqlLiteral: string }> | null {
    const assignments = this.splitCommaSafe(rawAssignments);
    if (assignments.length === 0) return null;

    const parsed: Array<{ name: string; valueSqlLiteral: string }> = [];
    for (const assignment of assignments) {
      const match = assignment.trim().match(/^@([A-Za-z_][\w$]*)\s*(?:=|:=)\s*([\s\S]+)$/);
      if (!match) {
        return null;
      }

      parsed.push({
        name: match[1].toLowerCase(),
        valueSqlLiteral: this.toSqlLiteral(match[2]),
      });
    }

    return parsed;
  }

  private decodeSqlStringLiteral(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length < 2) return null;

    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1).replace(/''/g, "'").replace(/\\'/g, "'");
    }

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).replace(/""/g, '"').replace(/\\"/g, '"');
    }

    return null;
  }

  private resolvePreparedSqlSource(sourceToken: string): { sql?: string; error?: string } {
    const trimmed = sourceToken.trim().replace(/;$/, '');
    const variableMatch = trimmed.match(/^@([A-Za-z_][\w$]*)$/);

    if (variableMatch) {
      const key = variableMatch[1].toLowerCase();
      const raw = this.sessionVariables.get(key);
      if (!raw) {
        return {
          error: `Unknown user variable '@${variableMatch[1]}' in PREPARE`,
        };
      }

      const decoded = this.decodeSqlStringLiteral(raw);
      if (decoded === null) {
        return {
          error: `PREPARE source variable '@${variableMatch[1]}' must contain SQL text as a quoted string.`,
        };
      }

      return { sql: decoded };
    }

    const decoded = this.decodeSqlStringLiteral(trimmed);
    if (decoded === null) {
      return { error: 'PREPARE expects a quoted SQL string or @variable source.' };
    }

    return { sql: decoded };
  }

  private injectPreparedStatementArguments(
    templateSql: string,
    argumentLiterals: string[],
  ): { sql?: string; error?: string } {
    let argIndex = 0;
    let missingArgument = false;

    const injected = transformSqlCodeSegments(templateSql, (segment) =>
      segment.replace(/\?/g, () => {
        const literal = argumentLiterals[argIndex];
        if (literal === undefined) {
          missingArgument = true;
          return '?';
        }

        argIndex += 1;
        return literal;
      }),
    );

    if (missingArgument) {
      return {
        error: `Prepared statement expects ${argIndex + 1} parameter(s) but received ${argumentLiterals.length}.`,
      };
    }

    if (argIndex < argumentLiterals.length) {
      return {
        error: `Prepared statement expects ${argIndex} parameter(s) but received ${argumentLiterals.length}.`,
      };
    }

    return { sql: injected };
  }

  private handlePreparedStatementCommand(rawSql: string, startTime: number): QueryResult | null {
    const cleaned = stripComments(rawSql).trim();
    if (!cleaned) return null;

    const setMatch = cleaned.match(/^SET\s+([\s\S]+)$/i);
    if (setMatch) {
      const parsedAssignments = this.parseSetUserVariableAssignments(
        setMatch[1].replace(/;$/, '').trim(),
      );
      if (parsedAssignments) {
        for (const assignment of parsedAssignments) {
          this.sessionVariables.set(assignment.name, assignment.valueSqlLiteral);
        }

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    const prepareMatch = cleaned.match(/^PREPARE\s+([A-Za-z_][\w$]*)\s+FROM\s+([\s\S]+)$/i);
    if (prepareMatch) {
      const key = prepareMatch[1].toLowerCase();
      const source = this.resolvePreparedSqlSource(prepareMatch[2]);
      if (!source.sql) {
        return sqlErrorEngine.fromMessage(source.error ?? 'Invalid PREPARE source', {
          sql: rawSql,
          startTime,
        });
      }

      this.preparedStatements.set(key, source.sql);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }

    const executeMatch = cleaned.match(
      /^EXECUTE\s+([A-Za-z_][\w$]*)(?:\s+USING\s+([\s\S]+))?\s*;?$/i,
    );
    if (executeMatch) {
      const statementName = executeMatch[1];
      const key = statementName.toLowerCase();
      const templateSql = this.preparedStatements.get(key);
      if (!templateSql) {
        return sqlErrorEngine.fromMessage(`Unknown prepared statement '${statementName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      const usingClause = executeMatch[2]?.replace(/;$/, '').trim() ?? '';
      const argumentLiterals: string[] = [];
      if (usingClause) {
        const args = this.splitCommaSafe(usingClause);
        for (const arg of args) {
          const variableMatch = arg.trim().match(/^@([A-Za-z_][\w$]*)$/);
          if (!variableMatch) {
            return sqlErrorEngine.fromMessage(
              'EXECUTE ... USING supports only @user_variable arguments in sandbox mode.',
              {
                sql: rawSql,
                startTime,
              },
            );
          }

          argumentLiterals.push(this.sessionVariables.get(variableMatch[1].toLowerCase()) ?? 'NULL');
        }
      }

      const injected = this.injectPreparedStatementArguments(templateSql, argumentLiterals);
      if (!injected.sql) {
        return sqlErrorEngine.fromMessage(injected.error ?? 'Invalid EXECUTE arguments', {
          sql: rawSql,
          startTime,
        });
      }

      return this.execute(injected.sql);
    }

    const deallocateMatch = cleaned.match(
      /^(?:DEALLOCATE|DROP)\s+PREPARE\s+([A-Za-z_][\w$]*)\s*;?$/i,
    );
    if (deallocateMatch) {
      const statementName = deallocateMatch[1];
      const key = statementName.toLowerCase();
      if (!this.preparedStatements.has(key)) {
        return sqlErrorEngine.fromMessage(`Unknown prepared statement '${statementName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      this.preparedStatements.delete(key);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }

    return null;
  }

  private detectUnsupportedMySqlCommand(rawSql: string, translatedSql: string): string | null {
    const cleaned = stripComments(rawSql);
    const normalized = cleaned.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;

    for (const unsupported of UNSUPPORTED_MYSQL_PATTERNS) {
      if (unsupported.pattern.test(normalized)) {
        return `${unsupported.reason} Unsupported in the SQLite-backed sandbox runtime.`;
      }
    }

    const leadingVerb = extractLeadingSqlVerb(cleaned);
    if (!leadingVerb) return null;

    const translatedLeadingVerb = extractLeadingSqlVerb(translatedSql);
    if (translatedLeadingVerb && SQLITE_EXECUTABLE_VERBS.has(translatedLeadingVerb)) {
      return null;
    }

    if (leadingVerb === 'SHOW' && /^\s*SHOW\b/i.test(translatedSql.trim())) {
      return `Unsupported SHOW command variant: '${normalized}'. This sandbox supports many SHOW commands, but not this variant yet.`;
    }

    if (leadingVerb === 'SHOW') {
      return null;
    }

    if (!SQLITE_EXECUTABLE_VERBS.has(leadingVerb)) {
      return `Unsupported MySQL command '${leadingVerb}'. This command requires MySQL server features that are unavailable in the SQLite-backed sandbox.`;
    }

    return null;
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
    if (leadingVerb === 'VACUUM') return 'ALTER';
    if (leadingVerb === 'DROP' || leadingVerb === 'RENAME') return 'DROP';
    if (leadingVerb === 'ANALYZE') return 'SELECT';
    if (leadingVerb === 'REINDEX') return 'INDEX';
    if (leadingVerb === 'ATTACH') return 'CREATE';
    if (leadingVerb === 'DETACH') return 'DROP';

    if (leadingVerb === 'PRAGMA') {
      const norm = cleaned.replace(/\s+/g, ' ').trim();
      return /=/.test(norm) ? 'ALTER' : 'SELECT';
    }

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

    if (targets.length === 0 && !this.isCurrentUserAdmin()) {
      const leadingVerb = extractLeadingSqlVerb(stripComments(sql));
      if (leadingVerb && !PRIVILEGE_EXEMPT_VERBS.has(leadingVerb)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to execute '${leadingVerb}' statements without explicit sandbox privilege support.`,
          {
            sql,
            startTime,
          },
        );
      }
    }

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
    this.preparedStatements.clear();
    this.sessionVariables.clear();
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

    const preparedStatementResult = this.handlePreparedStatementCommand(normalizedSql, start);
    if (preparedStatementResult) return preparedStatementResult;

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

    const unsupportedReason = this.detectUnsupportedMySqlCommand(normalizedSql, finalSql);
    if (unsupportedReason) {
      return sqlErrorEngine.fromMessage(unsupportedReason, {
        sql,
        translatedSql: finalSql,
        startTime: start,
      });
    }

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
    this.preparedStatements.clear();
    this.sessionVariables.clear();
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
