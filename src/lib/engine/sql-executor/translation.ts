import type { SqlJsDatabase, TranslatedQuery } from './types';
import type { Row } from '@/types/database';
import { emptyOkResult, statusResult, stripComments } from './utils';

function rewriteFunctionCalls(
  sql: string,
  functionNames: readonly string[],
  replacementBuilder: (fnName: string, argument: string) => string,
): string {
  const pattern = new RegExp(`\\b(${functionNames.join('|')})\\s*\\(`, 'gi');
  let output = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(sql)) !== null) {
    const fnName = match[1];
    const fnStart = match.index;
    const openParenIndex = pattern.lastIndex - 1;
    let depth = 1;
    let i = openParenIndex + 1;
    let inSingle = false;
    let inDouble = false;

    for (; i < sql.length; i += 1) {
      const ch = sql[i];

      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
        continue;
      }
      if (inSingle || inDouble) continue;

      if (ch === '(') depth += 1;
      if (ch === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    if (depth !== 0) {
      // Malformed call; stop rewriting to avoid corrupting query text.
      break;
    }

    const argument = sql.slice(openParenIndex + 1, i).trim();
    output += sql.slice(cursor, fnStart);
    output += replacementBuilder(fnName.toUpperCase(), argument);
    cursor = i + 1;
    pattern.lastIndex = cursor;
  }

  return output + sql.slice(cursor);
}

function applyAggregateCompatibilityRewrites(sql: string): {
  sql: string;
  columnRenames: Record<string, string>;
} {
  const columnRenames: Record<string, string> = {};

  const rewritten = rewriteFunctionCalls(
    sql,
    ['VAR_POP', 'VARIANCE', 'VAR_SAMP', 'STDDEV', 'STD', 'STDDEV_POP', 'STDDEV_SAMP'],
    (fnName, argument) => {
      const arg = argument || 'NULL';
      const variancePop = `(AVG((${arg}) * (${arg})) - AVG(${arg}) * AVG(${arg}))`;
      const varianceSamp = `CASE WHEN COUNT(${arg}) > 1 THEN ${variancePop} * COUNT(${arg}) / (COUNT(${arg}) - 1) ELSE NULL END`;

      let expanded: string;
      switch (fnName) {
        case 'VAR_POP':
        case 'VARIANCE':
          expanded = variancePop;
          break;
        case 'VAR_SAMP':
          expanded = varianceSamp;
          break;
        case 'STD':
        case 'STDDEV':
        case 'STDDEV_POP':
          expanded = `SQRT(${variancePop})`;
          break;
        case 'STDDEV_SAMP':
          expanded = `SQRT(${varianceSamp})`;
          break;
        default:
          return `${fnName}(${arg})`;
      }

      // Track the mapping so the caller can rename result columns
      columnRenames[expanded] = `${fnName}(${arg})`;
      return expanded;
    },
  );

  return { sql: rewritten, columnRenames };
}

export function translateMySQL(
  raw: string,
  db: SqlJsDatabase,
  activeDatabase: string,
  activeUser: string,
): TranslatedQuery {
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
        rows: [{ Database: activeDatabase }],
        rowCount: 1,
        executionTimeMs: 0,
      },
    };
  }

  // SHOW TABLES / SHOW FULL TABLES
  if (/^SHOW\s+(FULL\s+)?TABLES\s*;?$/i.test(norm)) {
    const tableColumn = `Tables_in_${activeDatabase}`;
    return {
      sql: `SELECT name AS '${tableColumn}' FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
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

  // SHOW ENGINES / SHOW STORAGE ENGINES
  if (/^SHOW\s+(?:STORAGE\s+)?ENGINES\s*;?$/i.test(norm)) {
    return {
      sql: null,
      result: {
        columns: ['Engine', 'Support', 'Comment'],
        rows: [
          {
            Engine: 'SQLite',
            Support: 'DEFAULT',
            Comment: 'SQLite WASM backend (MySQL-compatible mode)',
          },
        ],
        rowCount: 1,
        executionTimeMs: 0,
      },
    };
  }

  // SHOW CREATE DATABASE
  {
    const m = norm.match(/^SHOW\s+CREATE\s+DATABASE\s+[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      const dbName = m[1];
      return {
        sql: null,
        result: {
          columns: ['Database', 'Create Database'],
          rows: [
            {
              Database: dbName,
              'Create Database': `CREATE DATABASE \"${dbName}\"`,
            },
          ],
          rowCount: 1,
          executionTimeMs: 0,
        },
      };
    }
  }

  // CREATE DATABASE / DROP DATABASE — virtual (single-db in SQLite)
  if (/^CREATE\s+(DATABASE|SCHEMA)/i.test(upper)) {
    return {
      sql: null,
      result: emptyOkResult(),
    };
  }
  if (/^DROP\s+(DATABASE|SCHEMA)/i.test(upper)) {
    return {
      sql: null,
      result: emptyOkResult(),
    };
  }

  // USE database — no-op
  if (/^USE\s+/i.test(norm)) {
    return {
      sql: null,
      result: emptyOkResult(),
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

  // BEGIN [WORK|TRANSACTION]
  if (/^BEGIN(?:\s+(?:WORK|TRANSACTION))?\s*;?$/i.test(norm)) {
    return { sql: 'BEGIN' };
  }

  // COMMIT [WORK]
  if (/^COMMIT(?:\s+WORK)?\s*;?$/i.test(norm)) {
    return { sql: 'COMMIT' };
  }

  // ROLLBACK TO [SAVEPOINT] name
  {
    const m = norm.match(/^ROLLBACK\s+TO(?:\s+SAVEPOINT)?\s+[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      return { sql: `ROLLBACK TO SAVEPOINT \"${m[1]}\"` };
    }
  }

  // ROLLBACK [WORK]
  if (/^ROLLBACK(?:\s+WORK)?\s*;?$/i.test(norm)) {
    return { sql: 'ROLLBACK' };
  }

  // SAVEPOINT name
  {
    const m = norm.match(/^SAVEPOINT\s+[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      return { sql: `SAVEPOINT \"${m[1]}\"` };
    }
  }

  // RELEASE SAVEPOINT name
  {
    const m = norm.match(/^RELEASE\s+SAVEPOINT\s+[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      return { sql: `RELEASE SAVEPOINT \"${m[1]}\"` };
    }
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
      result: emptyOkResult(),
    };
  }

  // LOCK/UNLOCK TABLES — no-op in SQLite backend
  if (/^(LOCK\s+TABLES|UNLOCK\s+TABLES)\b/i.test(norm)) {
    return {
      sql: null,
      result: emptyOkResult(),
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
            User: activeUser,
            Host: 'localhost',
            db: activeDatabase,
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

  // FLUSH / RESET / KILL / PURGE (session/server admin operations) — no-op for single-user wasm engine
  if (/^(FLUSH\b|RESET\b|KILL\b|PURGE\s+BINARY\s+LOGS\b)/i.test(norm)) {
    return {
      sql: null,
      result: emptyOkResult(),
    };
  }

  // ANALYZE TABLE t → ANALYZE t
  {
    const m = norm.match(/^ANALYZE\s+TABLE\s+[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      return { sql: `ANALYZE \"${m[1]}\"` };
    }
  }

  // OPTIMIZE/CHECK/REPAIR TABLE t — informational stubs
  {
    const m = norm.match(/^(OPTIMIZE|CHECK|REPAIR)\s+TABLE\s+[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      const op = m[1].toLowerCase();
      const table = m[2];
      return {
        sql: null,
        result: statusResult([
          {
            Table: table,
            Op: op,
            Msg_type: 'status',
            Msg_text: 'OK (simulated for SQLite backend)',
          },
        ]),
      };
    }
  }

  // EXPLAIN <query> → EXPLAIN QUERY PLAN <query>
  {
    const m = norm.match(/^EXPLAIN(?:\s+FORMAT\s*=\s*\w+)?\s+(.+)$/i);
    if (m) {
      const target = m[1].trim();
      if (!/^[`"']?\w+[`"']?$/i.test(target)) {
        return { sql: `EXPLAIN QUERY PLAN ${target}` };
      }
    }
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

  // DATABASE() → current active database name
  translated = translated.replace(/\bDATABASE\s*\(\s*\)/gi, `'${activeDatabase}'`);
  // USER() / CURRENT_USER() → current session user
  translated = translated.replace(/\b(?:CURRENT_USER|USER)\s*\(\s*\)/gi, `'${activeUser}'`);
  // VERSION() → sqlite_version()
  translated = translated.replace(/\bVERSION\s*\(\s*\)/gi, 'sqlite_version()');

  // MySQL statistical aggregates not available in SQLite by default.
  const aggregateResult = applyAggregateCompatibilityRewrites(translated);
  translated = aggregateResult.sql;
  const columnRenames =
    Object.keys(aggregateResult.columnRenames).length > 0
      ? aggregateResult.columnRenames
      : undefined;

  return { sql: translated, columnRenames };
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
