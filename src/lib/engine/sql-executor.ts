import type { QueryResult, TableSchema, Row } from '@/types/database';

type SqlJsDatabase = {
  run: (sql: string) => void;
  exec: (sql: string) => { columns: string[]; values: unknown[][] }[];
  getRowsModified: () => number;
  close: () => void;
};

type SqlJs = {
  Database: new () => SqlJsDatabase;
};

let sqlPromise: Promise<SqlJs> | null = null;

function loadSqlJs(): Promise<SqlJs> {
  if (!sqlPromise) {
    sqlPromise = import('sql.js').then((mod) => {
      const initSqlJs = mod.default;
      return initSqlJs({
        locateFile: () => '/sql-wasm.wasm',
      });
    });
  }
  return sqlPromise;
}

export class SqlExecutor {
  private db: SqlJsDatabase | null = null;

  async init(): Promise<void> {
    const SQL = await loadSqlJs();
    this.db = new SQL.Database();
  }

  isReady(): boolean {
    return this.db !== null;
  }

  execute(sql: string): QueryResult {
    if (!this.db) throw new Error('Database not initialized. Call init() first.');

    const start = performance.now();
    try {
      const results = this.db.exec(sql);
      const elapsed = performance.now() - start;

      if (results.length === 0) {
        const rowsModified = this.db.getRowsModified();
        return {
          columns: [],
          rows: [],
          rowCount: rowsModified,
          executionTimeMs: elapsed,
        };
      }

      const { columns, values } = results[0];
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
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - start,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  getTables(): TableSchema[] {
    if (!this.db) return [];

    const result = this.db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    if (result.length === 0) return [];

    return result[0].values.map(([tableName]) => {
      const name = String(tableName);
      const pragmaResult = this.db!.exec(`PRAGMA table_info("${name}")`);
      const columns =
        pragmaResult.length > 0
          ? pragmaResult[0].values.map((row) => ({
              name: String(row[1]),
              type: String(row[2]),
              nullable: row[3] === 0,
              primaryKey: row[5] === 1,
            }))
          : [];

      return { name, columns };
    });
  }

  loadSQL(sql: string): QueryResult {
    return this.execute(sql);
  }

  reset(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    sqlPromise = null;
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
