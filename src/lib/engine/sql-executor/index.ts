import type { QueryResult, StatementQueryResult, TableSchema, Row } from '@/types/database';
import { sqlErrorEngine } from '@/lib/engine/sql-error-engine';
import { loadSqlJs, resetSqlJsLoader } from './sqljs-loader';
import { stripComments } from './utils';
import { translateMySQL } from './translation';
import { splitSqlStatements } from './statement-splitter';
import { isPlSqlBlock, runPlSqlBlock } from './plsql-runtime';
import { extractCursorDefinitions, normalizeMySqlTriggerDefinition } from './mysql-compat';
import type { SqlJs, SqlJsDatabase, SupportedPrivilege, DbUser, GrantEntry } from './types';
import { SUPPORTED_PRIVILEGES } from './types';

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
  private triggers = new Map<string, StoredTrigger>();
  private cursors = new Map<string, StoredCursor>();
  private activeDatabase = 'main';
  private users = new Map<string, DbUser>();
  private grants = new Map<string, GrantEntry[]>();
  private currentUserKey = 'admin@localhost';
  private readonly runtimeCursorScope = 'session';

  private procedureKey(database: string, name: string): string {
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
    const cleaned = stripComments(rawSql).trim().replace(/;$/, '').trim();
    if (!/^ALTER\s+TABLE\b/i.test(cleaned)) return null;

    const afterAlterTable = cleaned.replace(/^ALTER\s+TABLE\s+/i, '');
    const tableParsed = this.parseLeadingIdentifier(afterAlterTable);
    if (!tableParsed) return null;

    let tableName = tableParsed.identifier;
    const operationSegment = tableParsed.rest.trim();
    const operations = this.splitTopLevelComma(operationSegment);
    if (operations.length === 0) return null;

    for (const operation of operations) {
      const columnsMeta = this.getTableColumnMeta(tableName);
      if (columnsMeta.length === 0) {
        return sqlErrorEngine.fromMessage(`Table '${tableName}' doesn't exist`, {
          sql: rawSql,
          startTime,
        });
      }

      const modifyMatch = operation.match(/^MODIFY(?:\s+COLUMN)?\s+([\s\S]+)$/i);
      if (modifyMatch) {
        const replacementDefinition = this.normalizeAlterColumnDefinition(modifyMatch[1].trim());
        const targetParsed = this.parseLeadingIdentifier(replacementDefinition);
        if (!targetParsed) {
          return sqlErrorEngine.fromMessage('Invalid ALTER TABLE MODIFY syntax', {
            sql: rawSql,
            startTime,
          });
        }

        const sourceLower = targetParsed.identifier.toLowerCase();
        if (!columnsMeta.some((column) => column.name.toLowerCase() === sourceLower)) {
          return sqlErrorEngine.fromMessage(
            `Unknown column '${targetParsed.identifier}' in '${tableName}'`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const spec: RebuildColumnSpec[] = columnsMeta.map((column) =>
          column.name.toLowerCase() === sourceLower
            ? {
                name: targetParsed.identifier,
                definition: replacementDefinition,
                sourceName: column.name,
              }
            : { name: column.name, definition: column.definition, sourceName: column.name },
        );

        const result = this.rebuildTableWithSpec(tableName, spec, rawSql, startTime);
        if (result.error) return result;
        continue;
      }

      const changeMatch = operation.match(/^CHANGE(?:\s+COLUMN)?\s+([\s\S]+)$/i);
      if (changeMatch) {
        const sourceParsed = this.parseLeadingIdentifier(changeMatch[1].trim());
        if (!sourceParsed) {
          return sqlErrorEngine.fromMessage('Invalid ALTER TABLE CHANGE syntax', {
            sql: rawSql,
            startTime,
          });
        }
        const replacementDefinition = this.normalizeAlterColumnDefinition(sourceParsed.rest.trim());
        const targetParsed = this.parseLeadingIdentifier(replacementDefinition);
        if (!targetParsed) {
          return sqlErrorEngine.fromMessage('Invalid ALTER TABLE CHANGE target definition', {
            sql: rawSql,
            startTime,
          });
        }

        const sourceLower = sourceParsed.identifier.toLowerCase();
        if (!columnsMeta.some((column) => column.name.toLowerCase() === sourceLower)) {
          return sqlErrorEngine.fromMessage(
            `Unknown column '${sourceParsed.identifier}' in '${tableName}'`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const spec: RebuildColumnSpec[] = columnsMeta.map((column) =>
          column.name.toLowerCase() === sourceLower
            ? {
                name: targetParsed.identifier,
                definition: replacementDefinition,
                sourceName: column.name,
              }
            : { name: column.name, definition: column.definition, sourceName: column.name },
        );

        const result = this.rebuildTableWithSpec(tableName, spec, rawSql, startTime);
        if (result.error) return result;
        continue;
      }

      const renameColumnMatch = operation.match(/^RENAME\s+COLUMN\s+(.+)\s+TO\s+(.+)$/i);
      if (renameColumnMatch) {
        const sourceParsed = this.parseLeadingIdentifier(renameColumnMatch[1]);
        const targetParsed = this.parseLeadingIdentifier(renameColumnMatch[2]);
        if (!sourceParsed || !targetParsed) {
          return sqlErrorEngine.fromMessage('Invalid ALTER TABLE RENAME COLUMN syntax', {
            sql: rawSql,
            startTime,
          });
        }

        const sourceLower = sourceParsed.identifier.toLowerCase();
        if (!columnsMeta.some((column) => column.name.toLowerCase() === sourceLower)) {
          return sqlErrorEngine.fromMessage(
            `Unknown column '${sourceParsed.identifier}' in '${tableName}'`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const spec: RebuildColumnSpec[] = columnsMeta.map((column) =>
          column.name.toLowerCase() === sourceLower
            ? {
                name: targetParsed.identifier,
                definition: this.replaceLeadingIdentifier(
                  column.definition,
                  targetParsed.identifier,
                ),
                sourceName: column.name,
              }
            : { name: column.name, definition: column.definition, sourceName: column.name },
        );

        const result = this.rebuildTableWithSpec(tableName, spec, rawSql, startTime);
        if (result.error) return result;
        continue;
      }

      const dropColumnMatch = operation.match(/^DROP(?:\s+COLUMN)?\s+(?!INDEX\b)(?!KEY\b)(.+)$/i);
      if (dropColumnMatch) {
        const targetParsed = this.parseLeadingIdentifier(dropColumnMatch[1]);
        if (!targetParsed) {
          return sqlErrorEngine.fromMessage('Invalid ALTER TABLE DROP COLUMN syntax', {
            sql: rawSql,
            startTime,
          });
        }

        const targetLower = targetParsed.identifier.toLowerCase();
        const remaining = columnsMeta.filter((column) => column.name.toLowerCase() !== targetLower);
        if (remaining.length === columnsMeta.length) {
          return sqlErrorEngine.fromMessage(
            `Unknown column '${targetParsed.identifier}' in '${tableName}'`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }
        if (remaining.length === 0) {
          return sqlErrorEngine.fromMessage('Cannot drop all columns from a table.', {
            sql: rawSql,
            startTime,
          });
        }

        const spec: RebuildColumnSpec[] = remaining.map((column) => ({
          name: column.name,
          definition: column.definition,
          sourceName: column.name,
        }));
        const result = this.rebuildTableWithSpec(tableName, spec, rawSql, startTime);
        if (result.error) return result;
        continue;
      }

      const addColumnMatch = operation.match(
        /^ADD(?:\s+COLUMN)?\s+(?!UNIQUE\b)(?!INDEX\b)(?!KEY\b)(?!PRIMARY\b)(?!CONSTRAINT\b)([\s\S]+)$/i,
      );
      if (addColumnMatch) {
        let clauseBody = addColumnMatch[1].trim();
        let position: { first: boolean; after?: string } | null = null;

        const firstMatch = clauseBody.match(/\s+FIRST\s*$/i);
        if (firstMatch) {
          position = { first: true };
          clauseBody = clauseBody.slice(0, firstMatch.index).trim();
        } else {
          const afterMatch = clauseBody.match(/\s+AFTER\s+(.+)$/i);
          if (afterMatch && afterMatch.index !== undefined) {
            const parsedAfter = this.parseLeadingIdentifier(afterMatch[1]);
            if (!parsedAfter) {
              return sqlErrorEngine.fromMessage('Invalid ALTER TABLE ADD COLUMN AFTER syntax', {
                sql: rawSql,
                startTime,
              });
            }
            position = { first: false, after: parsedAfter.identifier };
            clauseBody = clauseBody.slice(0, afterMatch.index).trim();
          }
        }

        const normalizedDefinition = this.normalizeAlterColumnDefinition(clauseBody);
        const newParsed = this.parseLeadingIdentifier(normalizedDefinition);
        if (!newParsed) {
          return sqlErrorEngine.fromMessage('Invalid ALTER TABLE ADD COLUMN syntax', {
            sql: rawSql,
            startTime,
          });
        }

        const exists = columnsMeta.some(
          (column) => column.name.toLowerCase() === newParsed.identifier.toLowerCase(),
        );
        if (exists) {
          return sqlErrorEngine.fromMessage(
            `Duplicate column name '${newParsed.identifier}' in '${tableName}'`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const spec: RebuildColumnSpec[] = columnsMeta.map((column) => ({
          name: column.name,
          definition: column.definition,
          sourceName: column.name,
        }));

        const nextColumn: RebuildColumnSpec = {
          name: newParsed.identifier,
          definition: normalizedDefinition,
        };

        if (!position) {
          spec.push(nextColumn);
        } else if (position.first) {
          spec.unshift(nextColumn);
        } else {
          const afterIndex = spec.findIndex(
            (column) => column.name.toLowerCase() === (position.after ?? '').toLowerCase(),
          );
          if (afterIndex < 0) {
            return sqlErrorEngine.fromMessage(
              `Unknown column '${position.after}' in '${tableName}' for AFTER clause`,
              {
                sql: rawSql,
                startTime,
              },
            );
          }
          spec.splice(afterIndex + 1, 0, nextColumn);
        }

        const result = this.rebuildTableWithSpec(tableName, spec, rawSql, startTime);
        if (result.error) return result;
        continue;
      }

      const renameTableMatch = operation.match(/^RENAME\s+TO\s+(.+)$/i);
      if (renameTableMatch) {
        const nextTable = this.parseLeadingIdentifier(renameTableMatch[1]);
        if (!nextTable) {
          return sqlErrorEngine.fromMessage('Invalid ALTER TABLE RENAME TO syntax', {
            sql: rawSql,
            startTime,
          });
        }

        const activeDb = this.getActiveDb();
        if (!activeDb) {
          return sqlErrorEngine.fromMessage('Database not initialized. Call init() first.', {
            sql: rawSql,
            startTime,
          });
        }

        try {
          activeDb.run(
            `ALTER TABLE ${this.quoteIdentifier(tableName)} RENAME TO ${this.quoteIdentifier(nextTable.identifier)}`,
          );
        } catch (error) {
          return sqlErrorEngine.fromUnknownError(error, {
            sql: rawSql,
            startTime,
          });
        }

        tableName = nextTable.identifier;
        continue;
      }

      const addIndexMatch = operation.match(
        /^ADD\s+(UNIQUE\s+)?(?:INDEX|KEY)\s+(?:([`"']?[A-Za-z_][\w$]*[`"']?)\s*)?\(([^)]+)\)$/i,
      );
      if (addIndexMatch) {
        const isUnique = Boolean(addIndexMatch[1]);
        const explicitName = addIndexMatch[2]
          ? this.normalizeIdentifier(addIndexMatch[2])
          : `${tableName}_${addIndexMatch[3].replace(/[^A-Za-z0-9_]+/g, '_')}_idx`;
        const columns = this.splitTopLevelComma(addIndexMatch[3]).map((part) => {
          const parsed = this.parseLeadingIdentifier(part.trim());
          return parsed ? this.quoteIdentifier(parsed.identifier) : part.trim();
        });
        const createIndexSql = `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${this.quoteIdentifier(explicitName)} ON ${this.quoteIdentifier(tableName)} (${columns.join(', ')})`;
        const activeDb = this.getActiveDb();
        if (!activeDb) {
          return sqlErrorEngine.fromMessage('Database not initialized. Call init() first.', {
            sql: rawSql,
            startTime,
          });
        }
        try {
          activeDb.run(createIndexSql);
        } catch (error) {
          return sqlErrorEngine.fromUnknownError(error, {
            sql: rawSql,
            startTime,
          });
        }
        continue;
      }

      const dropIndexMatch = operation.match(/^DROP\s+INDEX\s+(.+)$/i);
      if (dropIndexMatch) {
        const parsed = this.parseLeadingIdentifier(dropIndexMatch[1]);
        if (!parsed) {
          return sqlErrorEngine.fromMessage('Invalid ALTER TABLE DROP INDEX syntax', {
            sql: rawSql,
            startTime,
          });
        }

        const activeDb = this.getActiveDb();
        if (!activeDb) {
          return sqlErrorEngine.fromMessage('Database not initialized. Call init() first.', {
            sql: rawSql,
            startTime,
          });
        }
        try {
          activeDb.run(`DROP INDEX IF EXISTS ${this.quoteIdentifier(parsed.identifier)}`);
        } catch (error) {
          return sqlErrorEngine.fromUnknownError(error, {
            sql: rawSql,
            startTime,
          });
        }
        continue;
      }

      return sqlErrorEngine.fromMessage(
        `Unsupported ALTER TABLE operation segment: '${operation}'.`,
        {
          sql: rawSql,
          startTime,
        },
      );
    }

    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: performance.now() - startTime,
    };
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
    let rewritten = body;

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
      const namePattern = new RegExp(
        `\\b${param.name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`,
        'gi',
      );
      rewritten = rewritten.replace(namePattern, argSql);
    }

    return { sql: rewritten };
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
      if (result.error) return result;
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    } finally {
      this.useDatabase(previousDb);
    }
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
    const norm = stripComments(sql).replace(/\s+/g, ' ').trim().toUpperCase();
    if (!norm) return null;

    if (/^(SELECT|SHOW|DESC|DESCRIBE|EXPLAIN|WITH\b.*SELECT\b)/.test(norm)) return 'SELECT';
    if (/^(INSERT|REPLACE)/.test(norm)) return 'INSERT';
    if (/^UPDATE/.test(norm)) return 'UPDATE';
    if (/^(DELETE|TRUNCATE)/.test(norm)) return 'DELETE';
    if (/^CALL/.test(norm)) return 'EXECUTE';
    if (/^CREATE\s+INDEX/.test(norm)) return 'INDEX';
    if (/^CREATE/.test(norm)) return 'CREATE';
    if (/^ALTER/.test(norm)) return 'ALTER';
    if (/^(DROP|RENAME)/.test(norm)) return 'DROP';

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

  private extractTargetTable(sql: string): string | undefined {
    const norm = sql.replace(/\s+/g, ' ').trim();
    // SELECT ... FROM table / INSERT INTO table / UPDATE table / DELETE FROM table
    const m =
      norm.match(/\bFROM\s+[`"']?(\w+)[`"']?/i) ??
      norm.match(/\bINTO\s+[`"']?(\w+)[`"']?/i) ??
      norm.match(/^UPDATE\s+[`"']?(\w+)[`"']?/i);
    return m ? m[1] : undefined;
  }

  private denyIfNoPrivilege(sql: string, startTime: number): QueryResult | null {
    const required = this.requiredPrivilegeForSql(sql);
    if (!required) return null;
    const targetTable = this.extractTargetTable(sql);
    if (this.hasPrivilege(required, this.activeDatabase, targetTable)) return null;

    return sqlErrorEngine.fromMessage(
      `Access denied for user '${this.getCurrentUserDisplay()}' to ${required} on database '${this.activeDatabase}'`,
      {
        sql,
        startTime,
      },
    );
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
    const cleaned = stripComments(rawSql);
    if (!cleaned) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }

    const norm = cleaned.replace(/\s+/g, ' ').trim();

    if (/^SHOW\s+USERS\s*;?$/i.test(norm)) {
      const rows = Array.from(this.users.values())
        .sort((a, b) => this.displayUser(a).localeCompare(this.displayUser(b)))
        .map((user) => ({
          User: this.displayUser(user),
          Host: user.host,
          Current: this.userKey(user.username, user.host) === this.currentUserKey ? 'YES' : 'NO',
        }));

      return {
        columns: ['User', 'Host', 'Current'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }

    {
      const m = norm.match(/^SHOW\s+GRANTS(?:\s+FOR\s+(.+))?\s*;?$/i);
      if (m) {
        const requested = m[1]?.trim();
        const targetUser = requested ? this.parseUserSpec(requested) : this.getCurrentUser();
        if (!targetUser) {
          return sqlErrorEngine.fromMessage('Invalid user in SHOW GRANTS', {
            sql: rawSql,
            startTime,
          });
        }

        const targetKey = this.userKey(targetUser.username, targetUser.host);
        const isSelf = targetKey === this.currentUserKey;
        if (!isSelf && !this.isCurrentUserAdmin()) {
          return sqlErrorEngine.fromMessage(
            'Access denied. Only admin can inspect grants for other users.',
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const grants = this.getGrantEntries(targetKey);
        const columnName = `Grants for ${this.formatUser(targetUser)}`;
        const rows: Row[] = grants.map((grant) => ({
          [columnName]: `GRANT ${Array.from(grant.privileges).join(', ')} ON ${grant.database}.${grant.table} TO ${this.formatUser(targetUser)}${grant.withGrantOption ? ' WITH GRANT OPTION' : ''}`,
        }));

        if (rows.length === 0) {
          rows.push({ [columnName]: `GRANT USAGE ON *.* TO ${this.formatUser(targetUser)}` });
        }

        return {
          columns: [columnName],
          rows,
          rowCount: rows.length,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^CREATE\s+USER(?:\s+IF\s+NOT\s+EXISTS)?\s+(.+)$/i);
      if (m) {
        if (!this.isCurrentUserAdmin()) {
          return sqlErrorEngine.fromMessage('Access denied. Only admin can create users.', {
            sql: rawSql,
            startTime,
          });
        }

        const hasIfNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(norm);
        const userParts = this.splitCommaSeparated(m[1].replace(/;$/, ''));

        for (const userPart of userParts) {
          const identifiedMatch = userPart.match(/\bIDENTIFIED\s+BY\s+'([^']*)'\s*$/i);
          const specToken = userPart.replace(/\bIDENTIFIED\s+BY\s+'[^']*'\s*$/i, '').trim();
          const parsed = this.parseUserSpec(specToken);
          if (!parsed) {
            return sqlErrorEngine.fromMessage(`Invalid user specification '${userPart}'`, {
              sql: rawSql,
              startTime,
            });
          }

          const key = this.userKey(parsed.username, parsed.host);
          if (this.users.has(key)) {
            if (hasIfNotExists) continue;
            return sqlErrorEngine.fromMessage(
              `Operation CREATE USER failed for ${this.formatUser(parsed)}`,
              {
                sql: rawSql,
                startTime,
              },
            );
          }

          this.users.set(key, {
            username: parsed.username,
            host: parsed.host,
            password: identifiedMatch?.[1],
          });
          this.grants.set(key, []);
        }

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^DROP\s+USER(?:\s+IF\s+EXISTS)?\s+(.+)$/i);
      if (m) {
        if (!this.isCurrentUserAdmin()) {
          return sqlErrorEngine.fromMessage('Access denied. Only admin can drop users.', {
            sql: rawSql,
            startTime,
          });
        }

        const hasIfExists = /\bIF\s+EXISTS\b/i.test(norm);
        const userParts = this.splitCommaSeparated(m[1].replace(/;$/, ''));

        for (const userPart of userParts) {
          const parsed = this.parseUserSpec(userPart);
          if (!parsed) {
            return sqlErrorEngine.fromMessage(`Invalid user specification '${userPart}'`, {
              sql: rawSql,
              startTime,
            });
          }

          const key = this.userKey(parsed.username, parsed.host);
          if (parsed.username.toLowerCase() === 'admin') {
            return sqlErrorEngine.fromMessage('Cannot drop default admin user.', {
              sql: rawSql,
              startTime,
            });
          }

          if (!this.users.has(key)) {
            if (hasIfExists) continue;
            return sqlErrorEngine.fromMessage(
              `Operation DROP USER failed for ${this.formatUser(parsed)}`,
              {
                sql: rawSql,
                startTime,
              },
            );
          }

          this.users.delete(key);
          this.grants.delete(key);
          if (this.currentUserKey === key) {
            this.currentUserKey = this.userKey('admin', 'localhost');
          }
        }

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^ALTER\s+USER\s+(.+?)\s+IDENTIFIED\s+BY\s+'([^']*)'\s*;?$/i);
      if (m) {
        if (!this.isCurrentUserAdmin()) {
          return sqlErrorEngine.fromMessage('Access denied. Only admin can alter users.', {
            sql: rawSql,
            startTime,
          });
        }

        const parsed = this.parseUserSpec(m[1]);
        if (!parsed) {
          return sqlErrorEngine.fromMessage('Invalid user specification in ALTER USER', {
            sql: rawSql,
            startTime,
          });
        }

        const key = this.userKey(parsed.username, parsed.host);
        const user = this.users.get(key);
        if (!user) {
          return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(parsed)}`, {
            sql: rawSql,
            startTime,
          });
        }

        user.password = m[2];
        this.users.set(key, user);
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^RENAME\s+USER\s+(.+)$/i);
      if (m) {
        if (!this.isCurrentUserAdmin()) {
          return sqlErrorEngine.fromMessage('Access denied. Only admin can rename users.', {
            sql: rawSql,
            startTime,
          });
        }

        const pairs = this.splitCommaSeparated(m[1].replace(/;$/, ''));
        for (const pair of pairs) {
          const pairMatch = pair.match(/^(.+?)\s+TO\s+(.+)$/i);
          if (!pairMatch) {
            return sqlErrorEngine.fromMessage(`Invalid RENAME USER segment '${pair}'`, {
              sql: rawSql,
              startTime,
            });
          }

          const fromUser = this.parseUserSpec(pairMatch[1]);
          const toUser = this.parseUserSpec(pairMatch[2]);
          if (!fromUser || !toUser) {
            return sqlErrorEngine.fromMessage(`Invalid RENAME USER segment '${pair}'`, {
              sql: rawSql,
              startTime,
            });
          }

          const fromKey = this.userKey(fromUser.username, fromUser.host);
          const toKey = this.userKey(toUser.username, toUser.host);
          const existing = this.users.get(fromKey);
          if (!existing) {
            return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(fromUser)}`, {
              sql: rawSql,
              startTime,
            });
          }
          if (this.users.has(toKey)) {
            return sqlErrorEngine.fromMessage(`User ${this.formatUser(toUser)} already exists`, {
              sql: rawSql,
              startTime,
            });
          }

          this.users.delete(fromKey);
          this.users.set(toKey, {
            username: toUser.username,
            host: toUser.host,
            password: existing.password,
          });

          const grantEntries = this.grants.get(fromKey) ?? [];
          this.grants.delete(fromKey);
          this.grants.set(toKey, grantEntries);

          if (this.currentUserKey === fromKey) {
            this.currentUserKey = toKey;
          }
        }

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^SET\s+PASSWORD\s+FOR\s+(.+?)\s*=\s*'?([^';]+)'?\s*;?$/i);
      if (m) {
        if (!this.isCurrentUserAdmin()) {
          return sqlErrorEngine.fromMessage('Access denied. Only admin can set passwords.', {
            sql: rawSql,
            startTime,
          });
        }

        const parsed = this.parseUserSpec(m[1]);
        if (!parsed) {
          return sqlErrorEngine.fromMessage('Invalid user specification in SET PASSWORD', {
            sql: rawSql,
            startTime,
          });
        }

        const key = this.userKey(parsed.username, parsed.host);
        const user = this.users.get(key);
        if (!user) {
          return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(parsed)}`, {
            sql: rawSql,
            startTime,
          });
        }

        user.password = m[2];
        this.users.set(key, user);
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(
        /^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+(.+?)(?:\s+WITH\s+GRANT\s+OPTION)?\s*;?$/i,
      );
      if (m) {
        if (!this.isCurrentUserAdmin()) {
          return sqlErrorEngine.fromMessage('Access denied. Only admin can grant privileges.', {
            sql: rawSql,
            startTime,
          });
        }

        const privileges = this.splitCommaSeparated(m[1])
          .map((token) => this.normalizePrivilegeToken(token))
          .filter((token): token is SupportedPrivilege => token !== null);

        if (privileges.length === 0) {
          return sqlErrorEngine.fromMessage('No supported privileges specified in GRANT', {
            sql: rawSql,
            startTime,
          });
        }

        const scope = this.parseGrantScope(m[2]);
        if (!scope) {
          return sqlErrorEngine.fromMessage(
            'Invalid privilege scope in GRANT. Use db.table form.',
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const usersRaw = this.splitCommaSeparated(m[3]);
        const withGrantOption = /\bWITH\s+GRANT\s+OPTION\b/i.test(norm);
        for (const userRaw of usersRaw) {
          const parsed = this.parseUserSpec(userRaw);
          if (!parsed) {
            return sqlErrorEngine.fromMessage(`Invalid user specification '${userRaw}'`, {
              sql: rawSql,
              startTime,
            });
          }

          const key = this.userKey(parsed.username, parsed.host);
          if (!this.users.has(key)) {
            return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(parsed)}`, {
              sql: rawSql,
              startTime,
            });
          }

          this.upsertGrant(key, scope, privileges, withGrantOption);
        }

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^REVOKE\s+(.+?)\s+ON\s+(.+?)\s+FROM\s+(.+)\s*;?$/i);
      if (m) {
        if (!this.isCurrentUserAdmin()) {
          return sqlErrorEngine.fromMessage('Access denied. Only admin can revoke privileges.', {
            sql: rawSql,
            startTime,
          });
        }

        const privileges = this.splitCommaSeparated(m[1])
          .map((token) => this.normalizePrivilegeToken(token))
          .filter((token): token is SupportedPrivilege => token !== null);

        if (privileges.length === 0) {
          return sqlErrorEngine.fromMessage('No supported privileges specified in REVOKE', {
            sql: rawSql,
            startTime,
          });
        }

        const scope = this.parseGrantScope(m[2]);
        if (!scope) {
          return sqlErrorEngine.fromMessage(
            'Invalid privilege scope in REVOKE. Use db.table form.',
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const usersRaw = this.splitCommaSeparated(m[3]);
        for (const userRaw of usersRaw) {
          const parsed = this.parseUserSpec(userRaw);
          if (!parsed) {
            return sqlErrorEngine.fromMessage(`Invalid user specification '${userRaw}'`, {
              sql: rawSql,
              startTime,
            });
          }

          const key = this.userKey(parsed.username, parsed.host);
          if (!this.users.has(key)) {
            return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(parsed)}`, {
              sql: rawSql,
              startTime,
            });
          }

          this.revokeGrant(key, scope, privileges);
        }

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^(?:SET\s+(?:SESSION\s+)?USER(?:\s*=)?|CHANGE\s+USER)\s+(.+)\s*;?$/i);
      if (m) {
        const target = this.parseUserSpec(m[1]);
        if (!target) {
          return sqlErrorEngine.fromMessage('Invalid user specification in SET USER/CHANGE USER', {
            sql: rawSql,
            startTime,
          });
        }

        const key = this.userKey(target.username, target.host);
        if (!this.users.has(key)) {
          return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(target)}`, {
            sql: rawSql,
            startTime,
          });
        }

        this.currentUserKey = key;
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    if (/^FLUSH\s+PRIVILEGES\s*;?$/i.test(norm)) {
      if (!this.isCurrentUserAdmin()) {
        return sqlErrorEngine.fromMessage('Access denied. Only admin can flush privileges.', {
          sql: rawSql,
          startTime,
        });
      }

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }

    if (/^SHOW\s+DATABASES\s*;?$/i.test(norm)) {
      const rows = this.listDatabases()
        .filter((name) => this.hasPrivilege('SELECT', name))
        .map((name) => ({ Database: name }));
      return {
        columns: ['Database'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }

    {
      const m = norm.match(/^SHOW\s+CREATE\s+DATABASE\s+[`"']?(\w+)[`"']?\s*;?$/i);
      if (m) {
        if (!this.isCurrentUserAdmin()) {
          return sqlErrorEngine.fromMessage('Access denied. Only admin can create databases.', {
            sql: rawSql,
            startTime,
          });
        }

        const requestedName = m[1];
        const dbName = this.resolveDatabaseName(requestedName);
        if (!dbName) {
          return sqlErrorEngine.fromMessage(`Unknown database '${requestedName}'`, {
            sql: rawSql,
            startTime,
          });
        }
        return {
          columns: ['Database', 'Create Database'],
          rows: [{ Database: dbName, 'Create Database': `CREATE DATABASE \"${dbName}\"` }],
          rowCount: 1,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^SHOW\s+(?:FULL\s+)?TABLES\s+(?:FROM|IN)\s+[`"']?(\w+)[`"']?\s*;?$/i);
      if (m) {
        if (!this.isCurrentUserAdmin()) {
          return sqlErrorEngine.fromMessage('Access denied. Only admin can drop databases.', {
            sql: rawSql,
            startTime,
          });
        }

        const requestedName = m[1];
        const dbName = this.resolveDatabaseName(requestedName);
        if (!dbName) {
          return sqlErrorEngine.fromMessage(`Unknown database '${requestedName}'`, {
            sql: rawSql,
            startTime,
          });
        }
        const db = this.databases.get(dbName);
        if (!db) return null;
        const result = db.exec(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        );
        const key = `Tables_in_${dbName}`;
        const rows: Row[] =
          result.length > 0
            ? result[0].values.map(([tableName]) => ({ [key]: String(tableName) }))
            : [];
        return {
          columns: [key],
          rows,
          rowCount: rows.length,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^SHOW\s+TRIGGERS(?:\s+(?:FROM|IN)\s+[`"']?(\w+)[`"']?)?\s*;?$/i);
      if (m) {
        const requestedName = m[1];
        const dbName = requestedName
          ? this.resolveDatabaseName(requestedName)
          : this.activeDatabase;
        if (!dbName) {
          return sqlErrorEngine.fromMessage(`Unknown database '${requestedName}'`, {
            sql: rawSql,
            startTime,
          });
        }

        if (!this.hasPrivilege('SELECT', dbName)) {
          return sqlErrorEngine.fromMessage(
            `Access denied for user '${this.getCurrentUserDisplay()}' to SHOW TRIGGERS on database '${dbName}'`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const db = this.databases.get(dbName);
        if (!db) {
          return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
            sql: rawSql,
            startTime,
          });
        }

        const result = db.exec(
          `SELECT name, tbl_name, sql
             FROM sqlite_master
            WHERE type='trigger'
            ORDER BY name`,
        );
        const rowsByTrigger = new Map<string, Row>();

        if (result.length > 0) {
          result[0].values.forEach(([name, table, statement]) => {
            const triggerName = String(name);
            rowsByTrigger.set(triggerName.toLowerCase(), {
              Trigger: triggerName,
              Table: String(table),
              Statement: String(statement ?? ''),
            });
          });
        }

        Array.from(this.triggers.values())
          .filter((trigger) => trigger.database === dbName)
          .forEach((trigger) => {
            rowsByTrigger.set(trigger.name.toLowerCase(), {
              Trigger: trigger.name,
              Table: trigger.table,
              Statement: trigger.definition,
            });
          });

        const rows = Array.from(rowsByTrigger.values()).sort((a, b) =>
          String(a.Trigger).localeCompare(String(b.Trigger)),
        );

        return {
          columns: ['Trigger', 'Table', 'Statement'],
          rows,
          rowCount: rows.length,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^SHOW\s+CREATE\s+TRIGGER\s+(.+)\s*;?$/i);
      if (m) {
        const parsed = this.parseQualifiedName(m[1]);
        if (!parsed) {
          return sqlErrorEngine.fromMessage('Invalid trigger name in SHOW CREATE TRIGGER', {
            sql: rawSql,
            startTime,
          });
        }

        const dbName = parsed.database
          ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
          : this.activeDatabase;
        const db = this.databases.get(dbName);
        if (!db) {
          return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
            sql: rawSql,
            startTime,
          });
        }

        const storedTrigger = this.triggers.get(this.triggerKey(dbName, parsed.name));
        const escapedName = parsed.name.replace(/'/g, "''");
        const result = db.exec(
          `SELECT sql FROM sqlite_master WHERE type='trigger' AND LOWER(name)=LOWER('${escapedName}')`,
        );
        if (!storedTrigger && (result.length === 0 || result[0].values.length === 0)) {
          return sqlErrorEngine.fromMessage(`Unknown trigger '${parsed.name}'`, {
            sql: rawSql,
            startTime,
          });
        }

        const statement = storedTrigger
          ? storedTrigger.definition
          : String(result[0].values[0][0] ?? '');
        return {
          columns: ['Trigger', 'Create Trigger'],
          rows: [{ Trigger: parsed.name, 'Create Trigger': statement }],
          rowCount: 1,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(
        /^CREATE\s+(?:DATABASE|SCHEMA)(?:\s+IF\s+NOT\s+EXISTS)?\s+[`"']?(\w+)[`"']?\s*;?$/i,
      );
      if (m) {
        const requestedName = m[1];
        const dbName = this.resolveDatabaseName(requestedName) ?? requestedName;
        const hasIfNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(norm);

        if (this.databases.has(dbName)) {
          if (hasIfNotExists) {
            return {
              columns: [],
              rows: [],
              rowCount: 0,
              executionTimeMs: performance.now() - startTime,
            };
          }
          return sqlErrorEngine.fromMessage(`Database '${dbName}' already exists`, {
            sql: rawSql,
            startTime,
          });
        }

        if (!this.sqlModule) {
          return sqlErrorEngine.fromMessage('Database engine is not initialized.', {
            sql: rawSql,
            startTime,
          });
        }

        const newDb = new this.sqlModule.Database();
        newDb.run('PRAGMA foreign_keys = ON;');
        this.databases.set(dbName, newDb);
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(
        /^DROP\s+(?:DATABASE|SCHEMA)(?:\s+IF\s+EXISTS)?\s+[`"']?(\w+)[`"']?\s*;?$/i,
      );
      if (m) {
        const requestedName = m[1];
        const dbName = this.resolveDatabaseName(requestedName) ?? requestedName;
        const hasIfExists = /\bIF\s+EXISTS\b/i.test(norm);

        if (dbName.toLowerCase() === 'main') {
          return sqlErrorEngine.fromMessage("Cannot drop default database 'main'", {
            sql: rawSql,
            startTime,
          });
        }

        const db = this.databases.get(dbName);
        if (!db) {
          if (hasIfExists) {
            return {
              columns: [],
              rows: [],
              rowCount: 0,
              executionTimeMs: performance.now() - startTime,
            };
          }
          return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
            sql: rawSql,
            startTime,
          });
        }

        db.close();
        this.databases.delete(dbName);
        for (const key of Array.from(this.procedures.keys())) {
          if (key.startsWith(`${dbName.toLowerCase()}.`)) {
            this.procedures.delete(key);
          }
        }
        for (const key of Array.from(this.triggers.keys())) {
          if (key.startsWith(`${dbName.toLowerCase()}.`)) {
            this.triggers.delete(key);
          }
        }
        for (const key of Array.from(this.cursors.keys())) {
          if (key.startsWith(`${dbName.toLowerCase()}.`)) {
            this.cursors.delete(key);
          }
        }
        if (this.activeDatabase === dbName) {
          this.activeDatabase = 'main';
        }
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const normalizedTrigger = normalizeMySqlTriggerDefinition(rawSql);
      if (normalizedTrigger) {
        const hasIfNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(rawSql);
        const parsedName = this.parseQualifiedName(normalizedTrigger.name);
        if (!parsedName) {
          return sqlErrorEngine.fromMessage('Invalid trigger name in CREATE TRIGGER', {
            sql: rawSql,
            startTime,
          });
        }

        const dbName = parsedName.database
          ? (this.resolveDatabaseName(parsedName.database) ?? parsedName.database)
          : this.activeDatabase;
        const db = this.databases.get(dbName);
        if (!db) {
          return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
            sql: rawSql,
            startTime,
          });
        }

        if (!this.hasPrivilege('CREATE', dbName)) {
          return sqlErrorEngine.fromMessage(
            `Access denied for user '${this.getCurrentUserDisplay()}' to CREATE trigger in database '${dbName}'`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const triggerKey = this.triggerKey(dbName, parsedName.name);
        if (this.triggers.has(triggerKey)) {
          if (hasIfNotExists) {
            return {
              columns: [],
              rows: [],
              rowCount: 0,
              executionTimeMs: performance.now() - startTime,
            };
          }

          return sqlErrorEngine.fromMessage(`Trigger '${parsedName.name}' already exists`, {
            sql: rawSql,
            startTime,
          });
        }

        try {
          db.run(normalizedTrigger.sqliteSql);
        } catch (error) {
          return sqlErrorEngine.fromUnknownError(error, {
            sql: rawSql,
            translatedSql: normalizedTrigger.sqliteSql,
            startTime,
          });
        }

        this.triggers.set(triggerKey, {
          database: dbName,
          name: parsedName.name,
          table: normalizedTrigger.table,
          definition: normalizedTrigger.definition,
          sqliteDefinition: normalizedTrigger.sqliteSql,
        });

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const createRoutine = rawSql
        .trim()
        .match(
          /^CREATE\s+PROCEDURE(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s(]+)\s*\(([\s\S]*)\)\s*BEGIN\s+([\s\S]*?)\s*END\s*;?$/i,
        );
      if (createRoutine) {
        const hasIfNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(rawSql);
        const name = this.parseQualifiedName(createRoutine[1]);
        if (!name) {
          return sqlErrorEngine.fromMessage('Invalid procedure name in CREATE PROCEDURE', {
            sql: rawSql,
            startTime,
          });
        }

        const dbName = name.database
          ? (this.resolveDatabaseName(name.database) ?? name.database)
          : this.activeDatabase;
        if (!this.databases.has(dbName)) {
          return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
            sql: rawSql,
            startTime,
          });
        }

        if (!this.hasPrivilege('CREATE', dbName)) {
          return sqlErrorEngine.fromMessage(
            `Access denied for user '${this.getCurrentUserDisplay()}' to CREATE procedure in database '${dbName}'`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const procName = name.name;
        const procKey = this.procedureKey(dbName, procName);
        if (this.procedures.has(procKey)) {
          if (hasIfNotExists) {
            return {
              columns: [],
              rows: [],
              rowCount: 0,
              executionTimeMs: performance.now() - startTime,
            };
          }
          return sqlErrorEngine.fromMessage(`Procedure '${procName}' already exists`, {
            sql: rawSql,
            startTime,
          });
        }

        this.procedures.set(procKey, {
          database: dbName,
          name: procName,
          params: this.parseProcedureParams(createRoutine[2] ?? ''),
          body: createRoutine[3].trim(),
          definition: rawSql.trim().replace(/;$/, ''),
        });

        for (const cursor of extractCursorDefinitions(createRoutine[3] ?? '')) {
          this.cursors.set(this.cursorKey(dbName, procName, cursor.name), {
            database: dbName,
            procedureName: procName,
            name: cursor.name,
            query: cursor.query,
            definition: cursor.definition,
          });
        }

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^DROP\s+TRIGGER(?:\s+IF\s+EXISTS)?\s+(.+)\s*;?$/i);
      if (m) {
        const hasIfExists = /\bIF\s+EXISTS\b/i.test(norm);
        const parsed = this.parseQualifiedName(m[1]);
        if (!parsed) {
          return sqlErrorEngine.fromMessage('Invalid trigger name in DROP TRIGGER', {
            sql: rawSql,
            startTime,
          });
        }

        const dbName = parsed.database
          ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
          : this.activeDatabase;
        if (!this.hasPrivilege('DROP', dbName)) {
          return sqlErrorEngine.fromMessage(
            `Access denied for user '${this.getCurrentUserDisplay()}' to DROP trigger in database '${dbName}'`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const db = this.databases.get(dbName);
        if (!db) {
          if (hasIfExists) {
            return {
              columns: [],
              rows: [],
              rowCount: 0,
              executionTimeMs: performance.now() - startTime,
            };
          }

          return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
            sql: rawSql,
            startTime,
          });
        }

        try {
          db.run(`DROP TRIGGER IF EXISTS ${this.quoteIdentifier(parsed.name)}`);
        } catch (error) {
          return sqlErrorEngine.fromUnknownError(error, {
            sql: rawSql,
            startTime,
          });
        }

        this.triggers.delete(this.triggerKey(dbName, parsed.name));
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^DROP\s+PROCEDURE(?:\s+IF\s+EXISTS)?\s+(.+)\s*;?$/i);
      if (m) {
        const hasIfExists = /\bIF\s+EXISTS\b/i.test(norm);
        const parsed = this.parseQualifiedName(m[1]);
        if (!parsed) {
          return sqlErrorEngine.fromMessage('Invalid procedure name in DROP PROCEDURE', {
            sql: rawSql,
            startTime,
          });
        }

        const dbName = parsed.database
          ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
          : this.activeDatabase;
        if (!this.hasPrivilege('DROP', dbName)) {
          return sqlErrorEngine.fromMessage(
            `Access denied for user '${this.getCurrentUserDisplay()}' to DROP procedure in database '${dbName}'`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        const procKey = this.procedureKey(dbName, parsed.name);
        if (!this.procedures.has(procKey)) {
          if (hasIfExists) {
            return {
              columns: [],
              rows: [],
              rowCount: 0,
              executionTimeMs: performance.now() - startTime,
            };
          }
          return sqlErrorEngine.fromMessage(`Unknown procedure '${parsed.name}'`, {
            sql: rawSql,
            startTime,
          });
        }

        this.clearProcedureMetadata(dbName, parsed.name);
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^SHOW\s+PROCEDURE\s+STATUS(?:\s+LIKE\s+'([^']+)')?\s*;?$/i);
      if (m) {
        const likePattern = m[1]?.toLowerCase();
        const rows = Array.from(this.procedures.values())
          .filter((proc) => this.hasPrivilege('SELECT', proc.database))
          .filter((proc) => !likePattern || proc.name.toLowerCase().includes(likePattern))
          .sort((a, b) => `${a.database}.${a.name}`.localeCompare(`${b.database}.${b.name}`))
          .map((proc) => ({
            Db: proc.database,
            Name: proc.name,
            Type: 'PROCEDURE',
          }));

        return {
          columns: ['Db', 'Name', 'Type'],
          rows,
          rowCount: rows.length,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(
        /^SHOW\s+CURSORS(?:\s+(?:FROM|IN)\s+[`"']?(\w+)[`"']?)?(?:\s+LIKE\s+'([^']+)')?\s*;?$/i,
      );
      if (m) {
        const requestedName = m[1];
        const dbName = requestedName
          ? (this.resolveDatabaseName(requestedName) ?? requestedName)
          : this.activeDatabase;
        const likePattern = m[2]?.toLowerCase();

        const rows = Array.from(this.cursors.values())
          .filter((cursor) => cursor.database === dbName)
          .filter((cursor) => !likePattern || cursor.name.toLowerCase().includes(likePattern))
          .sort((a, b) =>
            `${a.procedureName}.${a.name}`.localeCompare(`${b.procedureName}.${b.name}`),
          )
          .map((cursor) => ({
            Db: cursor.database,
            Procedure: cursor.procedureName,
            Cursor: cursor.name,
            Query: cursor.query,
          }));

        return {
          columns: ['Db', 'Procedure', 'Cursor', 'Query'],
          rows,
          rowCount: rows.length,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^SHOW\s+CREATE\s+CURSOR\s+(.+)\s*;?$/i);
      if (m) {
        const parsed = this.parseCursorReference(m[1]);
        if (!parsed) {
          return sqlErrorEngine.fromMessage('Invalid cursor name in SHOW CREATE CURSOR', {
            sql: rawSql,
            startTime,
          });
        }

        const matches = Array.from(this.cursors.values()).filter((cursor) => {
          const dbMatches = parsed.database ? cursor.database === parsed.database : true;
          const procedureMatches = parsed.procedureName
            ? cursor.procedureName === parsed.procedureName
            : true;
          return (
            dbMatches &&
            procedureMatches &&
            cursor.name.toLowerCase() === parsed.name.toLowerCase()
          );
        });

        if (matches.length === 0) {
          return sqlErrorEngine.fromMessage(`Unknown cursor '${parsed.name}'`, {
            sql: rawSql,
            startTime,
          });
        }

        const cursor = matches[0];
        return {
          columns: ['Cursor', 'Create Cursor'],
          rows: [
            {
              Cursor: `${cursor.procedureName}.${cursor.name}`,
              'Create Cursor': cursor.definition,
            },
          ],
          rowCount: 1,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^SHOW\s+CREATE\s+PROCEDURE\s+(.+)\s*;?$/i);
      if (m) {
        const parsed = this.parseQualifiedName(m[1]);
        if (!parsed) {
          return sqlErrorEngine.fromMessage('Invalid procedure name in SHOW CREATE PROCEDURE', {
            sql: rawSql,
            startTime,
          });
        }

        const dbName = parsed.database
          ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
          : this.activeDatabase;
        const procedure = this.procedures.get(this.procedureKey(dbName, parsed.name));
        if (!procedure) {
          return sqlErrorEngine.fromMessage(`Unknown procedure '${parsed.name}'`, {
            sql: rawSql,
            startTime,
          });
        }

        return {
          columns: ['Procedure', 'Create Procedure'],
          rows: [
            {
              Procedure: `${procedure.database}.${procedure.name}`,
              'Create Procedure': procedure.definition,
            },
          ],
          rowCount: 1,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const callMatch = rawSql.trim().match(/^CALL\s+([^\s(]+)\s*\((.*)\)\s*;?$/i);
      if (callMatch) {
        const parsed = this.parseQualifiedName(callMatch[1]);
        if (!parsed) {
          return sqlErrorEngine.fromMessage('Invalid procedure name in CALL', {
            sql: rawSql,
            startTime,
          });
        }

        const dbName = parsed.database
          ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
          : this.activeDatabase;
        const procedure = this.procedures.get(this.procedureKey(dbName, parsed.name));
        if (!procedure) {
          return sqlErrorEngine.fromMessage(`Unknown procedure '${parsed.name}'`, {
            sql: rawSql,
            startTime,
          });
        }

        return this.executeStoredProcedure(procedure, callMatch[2] ?? '', startTime, rawSql);
      }
    }

    {
      const m = norm.match(/^USE\s+[`"']?(\w+)[`"']?\s*;?$/i);
      if (m) {
        const requestedName = m[1];
        const dbName = this.resolveDatabaseName(requestedName);
        if (!dbName) {
          return sqlErrorEngine.fromMessage(`Unknown database '${requestedName}'`, {
            sql: rawSql,
            startTime,
          });
        }
        if (!this.hasPrivilege('SELECT', dbName)) {
          return sqlErrorEngine.fromMessage(
            `Access denied for user '${this.getCurrentUserDisplay()}' to USE database '${dbName}'`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        this.activeDatabase = dbName;
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    return null;
  }

  async init(): Promise<void> {
    const SQL = await loadSqlJs();
    this.sqlModule = SQL;
    this.databases.clear();
    this.procedures.clear();
    this.triggers.clear();
    this.cursors.clear();
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

    const finalSql = translated.sql ?? normalizedSql;

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
    this.triggers.clear();
    this.cursors.clear();
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
