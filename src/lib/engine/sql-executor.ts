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

/* ── MySQL → SQLite translation ───────────────────────── */

interface TranslatedQuery {
  sql: string | null; // null = handled internally, result already set
  result?: QueryResult; // pre-computed result for virtual commands
}

function stripComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}

function translateMySQL(raw: string, db: SqlJsDatabase): TranslatedQuery {
  const cleaned = stripComments(raw);
  // normalise whitespace for matching
  const norm = cleaned.replace(/\s+/g, ' ').trim();
  const upper = norm.toUpperCase();

  // SHOW DATABASES
  if (/^SHOW\s+DATABASES\s*;?$/i.test(norm)) {
    return {
      sql: null,
      result: {
        columns: ['Database'],
        rows: [{ Database: 'main' }],
        rowCount: 1,
        executionTimeMs: 0,
      },
    };
  }

  // SHOW TABLES / SHOW FULL TABLES
  if (/^SHOW\s+(FULL\s+)?TABLES\s*;?$/i.test(norm)) {
    return {
      sql: "SELECT name AS 'Tables_in_main' FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    };
  }

  // SHOW COLUMNS FROM / SHOW FIELDS FROM / DESCRIBE / DESC / EXPLAIN (table)
  {
    const m = norm.match(
      /^(?:SHOW\s+(?:FULL\s+)?(?:COLUMNS|FIELDS)\s+FROM|DESC(?:RIBE)?|EXPLAIN)\s+[`"']?(\w+)[`"']?\s*;?$/i,
    );
    if (m) {
      const table = m[1];
      return buildDescribeResult(table, db);
    }
  }

  // SHOW CREATE TABLE
  {
    const m = norm.match(/^SHOW\s+CREATE\s+TABLE\s+[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      const table = m[1];
      return buildShowCreateTable(table, db);
    }
  }

  // SHOW INDEX FROM / SHOW INDEXES FROM / SHOW KEYS FROM
  {
    const m = norm.match(/^SHOW\s+(?:INDEX|INDEXES|KEYS)\s+FROM\s+[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      const table = m[1];
      return { sql: `PRAGMA index_list("${table}")` };
    }
  }

  // SHOW TABLE STATUS
  if (/^SHOW\s+TABLE\s+STATUS/i.test(norm)) {
    return buildTableStatus(db);
  }

  // SHOW WARNINGS / SHOW ERRORS — no-op for SQLite
  if (/^SHOW\s+(WARNINGS|ERRORS)\s*;?$/i.test(norm)) {
    return {
      sql: null,
      result: {
        columns: ['Level', 'Code', 'Message'],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
      },
    };
  }

  // CREATE DATABASE / DROP DATABASE — virtual (single-db in SQLite)
  if (/^CREATE\s+(DATABASE|SCHEMA)/i.test(upper)) {
    return {
      sql: null,
      result: {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
      },
    };
  }
  if (/^DROP\s+(DATABASE|SCHEMA)/i.test(upper)) {
    return {
      sql: null,
      result: {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
      },
    };
  }

  // USE database — no-op
  if (/^USE\s+/i.test(norm)) {
    return {
      sql: null,
      result: {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
      },
    };
  }

  // TRUNCATE TABLE → DELETE FROM
  {
    const m = norm.match(/^TRUNCATE\s+(?:TABLE\s+)?[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      return { sql: `DELETE FROM "${m[1]}"` };
    }
  }

  // START TRANSACTION → BEGIN
  if (/^START\s+TRANSACTION/i.test(norm)) {
    return { sql: 'BEGIN' };
  }

  // SET — handle MySQL session variables as no-ops
  if (/^SET\s+/i.test(norm)) {
    // SET FOREIGN_KEY_CHECKS → PRAGMA foreign_keys
    {
      const m = norm.match(/^SET\s+(?:GLOBAL\s+|SESSION\s+)?FOREIGN_KEY_CHECKS\s*=\s*(\d+)/i);
      if (m) {
        return { sql: `PRAGMA foreign_keys = ${m[1] === '1' ? 'ON' : 'OFF'}` };
      }
    }
    // SET NAMES, SET CHARACTER SET, SET @@, SET SESSION → no-op
    return {
      sql: null,
      result: { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 },
    };
  }

  // RENAME TABLE x TO y → ALTER TABLE x RENAME TO y
  {
    const m = norm.match(/^RENAME\s+TABLE\s+[`"']?(\w+)[`"']?\s+TO\s+[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      return { sql: `ALTER TABLE "${m[1]}" RENAME TO "${m[2]}"` };
    }
  }

  // SHOW PROCESSLIST / SHOW STATUS / SHOW VARIABLES → informative stubs
  if (/^SHOW\s+(?:FULL\s+)?PROCESSLIST/i.test(norm)) {
    return {
      sql: null,
      result: {
        columns: ['Id', 'User', 'Host', 'db', 'Command', 'Time', 'State', 'Info'],
        rows: [
          {
            Id: 1,
            User: 'user',
            Host: 'localhost',
            db: 'main',
            Command: 'Query',
            Time: 0,
            State: '',
            Info: null,
          },
        ],
        rowCount: 1,
        executionTimeMs: 0,
      },
    };
  }
  if (/^SHOW\s+(GLOBAL\s+|SESSION\s+)?VARIABLES/i.test(norm)) {
    return {
      sql: null,
      result: {
        columns: ['Variable_name', 'Value'],
        rows: [
          { Variable_name: 'version', Value: 'SQLite (WASM) — MySQL-compatible mode' },
          { Variable_name: 'max_connections', Value: '1' },
        ],
        rowCount: 2,
        executionTimeMs: 0,
      },
    };
  }
  if (/^SHOW\s+(GLOBAL\s+|SESSION\s+)?STATUS/i.test(norm)) {
    return {
      sql: null,
      result: {
        columns: ['Variable_name', 'Value'],
        rows: [{ Variable_name: 'Uptime', Value: '0' }],
        rowCount: 1,
        executionTimeMs: 0,
      },
    };
  }

  // ENGINE=... / DEFAULT CHARSET=... / AUTO_INCREMENT — strip MySQL-specific clauses
  let translated = cleaned;

  // Strip ENGINE=..., DEFAULT CHARSET=..., COLLATE=..., AUTO_INCREMENT=..., COMMENT=...
  translated = translated.replace(/\s+ENGINE\s*=\s*\S+/gi, '');
  translated = translated.replace(/\s+DEFAULT\s+CHARSET\s*=\s*\S+/gi, '');
  translated = translated.replace(/\s+CHARSET\s*=\s*\S+/gi, '');
  translated = translated.replace(/\s+COLLATE\s*=\s*\S+/gi, '');
  translated = translated.replace(/\s+AUTO_INCREMENT\s*=\s*\d+/gi, '');
  translated = translated.replace(/\s+COMMENT\s*=\s*'[^']*'/gi, '');

  // INT AUTO_INCREMENT → INTEGER PRIMARY KEY (SQLite autoincrement)
  translated = translated.replace(
    /\bINT(?:EGER)?\s+AUTO_INCREMENT/gi,
    'INTEGER PRIMARY KEY AUTOINCREMENT',
  );
  // standalone AUTO_INCREMENT
  translated = translated.replace(/\s+AUTO_INCREMENT/gi, '');

  // MySQL type mappings
  translated = translated.replace(/\bVARCHAR\s*\(\d+\)/gi, 'TEXT');
  translated = translated.replace(/\bCHAR\s*\(\d+\)/gi, 'TEXT');
  translated = translated.replace(/\bLONGTEXT\b/gi, 'TEXT');
  translated = translated.replace(/\bMEDIUMTEXT\b/gi, 'TEXT');
  translated = translated.replace(/\bTINYTEXT\b/gi, 'TEXT');
  translated = translated.replace(/\bENUM\s*\([^)]+\)/gi, 'TEXT');
  translated = translated.replace(/\bSET\s*\([^)]+\)/gi, 'TEXT');
  translated = translated.replace(/\bDATETIME\b/gi, 'TEXT');
  translated = translated.replace(/\bTIMESTAMP\b/gi, 'TEXT');
  translated = translated.replace(/\bDATE\b/gi, 'TEXT');
  translated = translated.replace(/\bTIME\b/gi, 'TEXT');
  translated = translated.replace(/\bYEAR\b/gi, 'INTEGER');
  translated = translated.replace(/\bTINYINT\s*\(\d+\)/gi, 'INTEGER');
  translated = translated.replace(/\bSMALLINT\b/gi, 'INTEGER');
  translated = translated.replace(/\bMEDIUMINT\b/gi, 'INTEGER');
  translated = translated.replace(/\bBIGINT\b/gi, 'INTEGER');
  translated = translated.replace(/\bINT\s*\(\d+\)/gi, 'INTEGER');
  translated = translated.replace(/\bDOUBLE(?:\s+PRECISION)?\b/gi, 'REAL');
  translated = translated.replace(/\bFLOAT(?:\s*\([^)]*\))?\b/gi, 'REAL');
  translated = translated.replace(/\bDECIMAL\s*\([^)]+\)/gi, 'REAL');
  translated = translated.replace(/\bNUMERIC\s*\([^)]+\)/gi, 'REAL');
  translated = translated.replace(/\bBOOLEAN\b/gi, 'INTEGER');
  translated = translated.replace(/\bBOOL\b/gi, 'INTEGER');
  translated = translated.replace(/\bBLOB\b/gi, 'BLOB');
  translated = translated.replace(/\bLONGBLOB\b/gi, 'BLOB');
  translated = translated.replace(/\bMEDIUMBLOB\b/gi, 'BLOB');
  translated = translated.replace(/\bTINYBLOB\b/gi, 'BLOB');
  translated = translated.replace(/\bJSON\b/gi, 'TEXT');

  // UNSIGNED — strip
  translated = translated.replace(/\s+UNSIGNED/gi, '');

  // INSERT IGNORE → INSERT OR IGNORE
  translated = translated.replace(/\bINSERT\s+IGNORE\b/gi, 'INSERT OR IGNORE');

  // REPLACE INTO → INSERT OR REPLACE INTO
  translated = translated.replace(/\bREPLACE\s+INTO\b/gi, 'INSERT OR REPLACE INTO');

  // ON DUPLICATE KEY UPDATE → ON CONFLICT DO UPDATE SET
  translated = translated.replace(
    /\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/gi,
    'ON CONFLICT DO UPDATE SET',
  );

  // ALTER TABLE ... MODIFY COLUMN → not fully supported, but strip MODIFY for simple cases
  // ALTER TABLE ... CHANGE COLUMN old new TYPE → ALTER TABLE ... RENAME COLUMN old TO new
  // (Limited support — SQLite ALTER TABLE is restricted)

  // Backtick → double-quote
  translated = translated.replace(/`/g, '"');

  // LIMIT x, y → LIMIT y OFFSET x
  translated = translated.replace(/\bLIMIT\s+(\d+)\s*,\s*(\d+)/gi, 'LIMIT $2 OFFSET $1');

  // IFNULL already works in SQLite; NVL → IFNULL
  translated = translated.replace(/\bNVL\s*\(/gi, 'IFNULL(');

  // DEFAULT NOW() / CURDATE() / CURTIME() — SQLite needs parens around function defaults
  translated = translated.replace(/\bDEFAULT\s+NOW\s*\(\s*\)/gi, "DEFAULT (datetime('now'))");
  translated = translated.replace(/\bDEFAULT\s+CURDATE\s*\(\s*\)/gi, "DEFAULT (date('now'))");
  translated = translated.replace(/\bDEFAULT\s+CURTIME\s*\(\s*\)/gi, "DEFAULT (time('now'))");
  translated = translated.replace(/\bDEFAULT\s+CURRENT_TIMESTAMP\b/gi, "DEFAULT (datetime('now'))");

  // NOW() → datetime('now')  (non-DEFAULT contexts like INSERT values)
  translated = translated.replace(/\bNOW\s*\(\s*\)/gi, "datetime('now')");
  // CURDATE() → date('now')
  translated = translated.replace(/\bCURDATE\s*\(\s*\)/gi, "date('now')");
  // CURTIME() → time('now')
  translated = translated.replace(/\bCURTIME\s*\(\s*\)/gi, "time('now')");

  // CONCAT() → || operator (simple two-arg form)
  // MySQL: CONCAT(a, b, c) — handled via recursive replacement for 2+ args
  translated = translated.replace(/\bCONCAT\s*\(([^()]+)\)/gi, (_match, args: string) => {
    const parts = args.split(',').map((s: string) => s.trim());
    return parts.join(' || ');
  });

  // ISNULL(x) → x IS NULL (MySQL function form)
  translated = translated.replace(/\bISNULL\s*\(([^)]+)\)/gi, '($1 IS NULL)');

  // DATABASE() → 'main'
  translated = translated.replace(/\bDATABASE\s*\(\s*\)/gi, "'main'");
  // USER() / CURRENT_USER() → 'user'
  translated = translated.replace(/\b(?:CURRENT_USER|USER)\s*\(\s*\)/gi, "'user'");
  // VERSION() → sqlite_version()
  translated = translated.replace(/\bVERSION\s*\(\s*\)/gi, 'sqlite_version()');

  return { sql: translated };
}

function buildDescribeResult(table: string, db: SqlJsDatabase): TranslatedQuery {
  const start = performance.now();
  try {
    const info = db.exec(`PRAGMA table_info("${table}")`);
    if (info.length === 0) {
      return {
        sql: null,
        result: {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - start,
          error: `Table '${table}' doesn't exist`,
        },
      };
    }
    const rows: Row[] = info[0].values.map((r) => ({
      Field: r[1],
      Type: r[2] || 'TEXT',
      Null: r[3] === 0 ? 'YES' : 'NO',
      Key: r[5] === 1 ? 'PRI' : '',
      Default: r[4] ?? 'NULL',
      Extra: '',
    }));
    return {
      sql: null,
      result: {
        columns: ['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - start,
      },
    };
  } catch {
    return {
      sql: null,
      result: {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - start,
        error: `Table '${table}' doesn't exist`,
      },
    };
  }
}

function buildShowCreateTable(table: string, db: SqlJsDatabase): TranslatedQuery {
  const start = performance.now();
  try {
    const r = db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`);
    if (r.length === 0 || r[0].values.length === 0) {
      return {
        sql: null,
        result: {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - start,
          error: `Table '${table}' doesn't exist`,
        },
      };
    }
    return {
      sql: null,
      result: {
        columns: ['Table', 'Create Table'],
        rows: [{ Table: table, 'Create Table': r[0].values[0][0] }],
        rowCount: 1,
        executionTimeMs: performance.now() - start,
      },
    };
  } catch {
    return {
      sql: null,
      result: {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - start,
        error: `Table '${table}' doesn't exist`,
      },
    };
  }
}

function buildTableStatus(db: SqlJsDatabase): TranslatedQuery {
  const start = performance.now();
  try {
    const r = db.exec(
      "SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    if (r.length === 0) {
      return {
        sql: null,
        result: {
          columns: ['Name', 'Engine', 'Rows'],
          rows: [],
          rowCount: 0,
          executionTimeMs: performance.now() - start,
        },
      };
    }
    const rows: Row[] = r[0].values.map(([name]) => {
      let rowCount = 0;
      try {
        const cnt = db.exec(`SELECT COUNT(*) FROM "${name}"`);
        if (cnt.length > 0) rowCount = Number(cnt[0].values[0][0]);
      } catch {
        /* empty */
      }
      return { Name: name, Engine: 'SQLite', Rows: rowCount };
    });
    return {
      sql: null,
      result: {
        columns: ['Name', 'Engine', 'Rows'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - start,
      },
    };
  } catch {
    return {
      sql: null,
      result: { columns: [], rows: [], rowCount: 0, executionTimeMs: performance.now() - start },
    };
  }
}

/* ── Executor ─────────────────────────────────────────── */

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

    // Run MySQL translation
    const translated = translateMySQL(sql, this.db);

    // If translation produced a pre-computed result, return it with timing
    if (translated.sql === null && translated.result) {
      return { ...translated.result, executionTimeMs: performance.now() - start };
    }

    const finalSql = translated.sql ?? sql;

    try {
      const results = this.db.exec(finalSql);
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
