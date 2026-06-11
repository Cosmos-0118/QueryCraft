import type { SqlJsDatabase, TranslatedQuery } from './types';
import type { Row } from '@/types/database';
import { emptyOkResult, statusResult, stripComments } from './utils';
import { rewriteSubqueryOperators } from './subquery-rewriter';
import { transformSqlCodeSegments } from './sql-lexer';

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
    let inBacktick = false;

    for (; i < sql.length; i += 1) {
      const ch = sql[i];
      const next = i + 1 < sql.length ? sql[i + 1] : '';

      if (ch === "'" && !inDouble && !inBacktick) {
        if (inSingle && next === "'") {
          i += 1;
          continue;
        }
        inSingle = !inSingle;
        continue;
      }

      if (ch === '"' && !inSingle && !inBacktick) {
        if (inDouble && next === '"') {
          i += 1;
          continue;
        }
        inDouble = !inDouble;
        continue;
      }

      if (ch === '`' && !inSingle && !inDouble) {
        if (inBacktick && next === '`') {
          i += 1;
          continue;
        }
        inBacktick = !inBacktick;
        continue;
      }

      if (inSingle || inDouble || inBacktick) continue;

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

function splitTopLevelComma(raw: string): string[] {
  const out: string[] = [];
  let current = '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    const next = i + 1 < raw.length ? raw[i + 1] : '';

    if (ch === "'" && !inDouble && !inBacktick) {
      if (inSingle && next === "'") {
        current += ch;
        current += next;
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingle && !inBacktick) {
      if (inDouble && next === '"') {
        current += ch;
        current += next;
        i += 1;
        continue;
      }
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (ch === '`' && !inSingle && !inDouble) {
      if (inBacktick && next === '`') {
        current += ch;
        current += next;
        i += 1;
        continue;
      }
      inBacktick = !inBacktick;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) {
        out.push(current.trim());
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

function applyConcatCompatibilityRewrites(sql: string): string {
  let rewritten = sql;

  while (true) {
    const next = rewriteFunctionCalls(rewritten, ['CONCAT'], (_fnName, argument) => {
      const parts = splitTopLevelComma(argument)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      if (parts.length === 0) return "''";
      if (parts.length === 1) return parts[0];
      return parts.join(' || ');
    });

    if (next === rewritten) {
      return next;
    }

    rewritten = next;
  }
}

function findMatchingParen(sql: string, openIndex: number): number {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  for (let i = openIndex; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (ch === "'" && !inDouble && !inBacktick) {
      if (inSingle && next === "'") {
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle && !inBacktick) {
      if (inDouble && next === '"') {
        i += 1;
        continue;
      }
      inDouble = !inDouble;
      continue;
    }

    if (ch === '`' && !inSingle && !inDouble) {
      if (inBacktick && next === '`') {
        i += 1;
        continue;
      }
      inBacktick = !inBacktick;
      continue;
    }

    if (inSingle || inDouble || inBacktick) continue;

    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function mapColumnType(typeName: string): string | null {
  const upper = typeName.toUpperCase();
  if (
    upper === 'VARCHAR' ||
    upper === 'CHAR' ||
    upper === 'LONGTEXT' ||
    upper === 'MEDIUMTEXT' ||
    upper === 'TINYTEXT' ||
    upper === 'ENUM' ||
    upper === 'SET' ||
    upper === 'DATETIME' ||
    upper === 'TIMESTAMP' ||
    upper === 'DATE' ||
    upper === 'TIME' ||
    upper === 'JSON'
  ) {
    return 'TEXT';
  }

  if (
    upper === 'INT' ||
    upper === 'INTEGER' ||
    upper === 'TINYINT' ||
    upper === 'SMALLINT' ||
    upper === 'MEDIUMINT' ||
    upper === 'BIGINT' ||
    upper === 'BOOLEAN' ||
    upper === 'BOOL'
  ) {
    return 'INTEGER';
  }

  if (
    upper === 'DECIMAL' ||
    upper === 'NUMERIC' ||
    upper === 'FLOAT' ||
    upper === 'DOUBLE' ||
    upper === 'DOUBLE PRECISION'
  ) {
    return 'REAL';
  }

  if (
    upper === 'BLOB' ||
    upper === 'LONGBLOB' ||
    upper === 'MEDIUMBLOB' ||
    upper === 'TINYBLOB'
  ) {
    return 'BLOB';
  }

  return null;
}

function rewriteColumnDefinitionType(definition: string): string {
  const trimmed = definition.trim();
  if (!trimmed) return trimmed;

  if (/^(PRIMARY|UNIQUE|KEY|INDEX|CONSTRAINT|CHECK|FOREIGN)\b/i.test(trimmed)) {
    return trimmed;
  }

  const identifierMatch =
    trimmed.match(/^(`[^`]+`|"[^"]+"|'[^']+'|[A-Za-z_][\w$]*)([\s\S]*)$/) ?? null;
  if (!identifierMatch) return trimmed;

  const identifier = identifierMatch[1];
  let rest = identifierMatch[2].trimStart();
  if (!rest) return trimmed;

  const typeWordMatch = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
  if (!typeWordMatch) return trimmed;

  let typeName = typeWordMatch[1].toUpperCase();
  let cursor = typeWordMatch[0].length;

  if (typeName === 'DOUBLE') {
    const precisionMatch = rest.slice(cursor).match(/^\s+PRECISION\b/i);
    if (precisionMatch) {
      typeName = 'DOUBLE PRECISION';
      cursor += precisionMatch[0].length;
    }
  }

  const afterType = rest.slice(cursor);
  const argsMatch = afterType.match(/^\s*\(/);
  if (argsMatch) {
    const openOffset = cursor + (argsMatch.index ?? 0) + argsMatch[0].indexOf('(');
    const closeIndex = findMatchingParen(rest, openOffset);
    if (closeIndex > openOffset) {
      cursor = closeIndex + 1;
    }
  }

  const originalTypeSpec = rest.slice(0, cursor).trimEnd();
  rest = rest.slice(cursor);
  rest = rest.replace(/^\s+UNSIGNED\b/i, '');
  const suffix = rest.trimStart();

  const mapped = mapColumnType(typeName);
  if (!mapped) {
    return `${identifier} ${originalTypeSpec}${suffix ? ` ${suffix}` : ''}`;
  }

  return `${identifier} ${mapped}${suffix ? ` ${suffix}` : ''}`;
}

function rewriteCreateTableTypes(sql: string): string {
  if (!/^CREATE\s+(?:TEMPORARY\s+)?TABLE\b/i.test(sql.trim())) {
    return sql;
  }

  let openIndex = -1;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (ch === "'" && !inDouble && !inBacktick) {
      if (inSingle && next === "'") {
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle && !inBacktick) {
      if (inDouble && next === '"') {
        i += 1;
        continue;
      }
      inDouble = !inDouble;
      continue;
    }

    if (ch === '`' && !inSingle && !inDouble) {
      if (inBacktick && next === '`') {
        i += 1;
        continue;
      }
      inBacktick = !inBacktick;
      continue;
    }

    if (inSingle || inDouble || inBacktick) continue;
    if (ch === '(') {
      openIndex = i;
      break;
    }
  }

  if (openIndex < 0) return sql;
  const closeIndex = findMatchingParen(sql, openIndex);
  if (closeIndex <= openIndex) return sql;

  const body = sql.slice(openIndex + 1, closeIndex);
  const parts = splitTopLevelComma(body);
  if (parts.length === 0) return sql;

  const rewrittenBody = parts.map(rewriteColumnDefinitionType).join(', ');
  return `${sql.slice(0, openIndex + 1)}${rewrittenBody}${sql.slice(closeIndex)}`;
}

function normalizeIdentifierToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  if (
    (trimmed.startsWith('`') && trimmed.endsWith('`')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function parseInsertTarget(sqlBeforeDuplicate: string): { table: string; insertColumns: string[] | null } | null {
  const match = sqlBeforeDuplicate.match(
    /^\s*INSERT(?:\s+OR\s+\w+)?\s+INTO\s+((?:`[^`]+`|"[^"]+"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:`[^`]+`|"[^"]+"|[A-Za-z_][\w$]*))?)\s*([\s\S]*)$/i,
  );
  if (!match) return null;

  const rawTable = match[1];
  const tableSegments = rawTable
    .split('.')
    .map((segment) => normalizeIdentifierToken(segment))
    .filter(Boolean);
  const table = tableSegments[tableSegments.length - 1];
  if (!table) return null;

  const rest = match[2] ?? '';
  const nonSpaceIndex = rest.search(/\S/);
  if (nonSpaceIndex < 0 || rest[nonSpaceIndex] !== '(') {
    return { table, insertColumns: null };
  }

  const closeIndex = findMatchingParen(rest, nonSpaceIndex);
  if (closeIndex <= nonSpaceIndex) {
    return { table, insertColumns: null };
  }

  const rawColumns = rest.slice(nonSpaceIndex + 1, closeIndex);
  const insertColumns = splitTopLevelComma(rawColumns)
    .map((column) => normalizeIdentifierToken(column))
    .map((column) => {
      const parts = column.split('.').map((part) => normalizeIdentifierToken(part)).filter(Boolean);
      return parts[parts.length - 1] ?? column;
    })
    .filter((column) => column.length > 0);

  return { table, insertColumns: insertColumns.length > 0 ? insertColumns : null };
}

function resolveUniqueConstraintCandidates(table: string, db: SqlJsDatabase): string[][] {
  const candidates: string[][] = [];
  const dedupe = new Set<string>();

  const addCandidate = (columns: string[]) => {
    const normalized = columns.map((column) => column.trim()).filter((column) => column.length > 0);
    if (normalized.length === 0) return;

    const key = normalized.map((column) => column.toLowerCase()).join('|');
    if (dedupe.has(key)) return;
    dedupe.add(key);
    candidates.push(normalized);
  };

  try {
    const indexList = db.exec(`PRAGMA index_list(${quoteIdentifier(table)})`);
    if (indexList.length > 0) {
      for (const row of indexList[0].values) {
        const isUnique = Number(row[2] ?? 0) === 1;
        if (!isUnique) continue;

        const indexName = String(row[1] ?? '').trim();
        if (!indexName) continue;

        const indexInfo = db.exec(`PRAGMA index_info(${quoteIdentifier(indexName)})`);
        if (indexInfo.length === 0) continue;

        const ordered = [...indexInfo[0].values].sort(
          (a, b) => Number(a[0] ?? 0) - Number(b[0] ?? 0),
        );
        const columns = ordered
          .map((infoRow) => String(infoRow[2] ?? '').trim())
          .filter((column) => column.length > 0);

        addCandidate(columns);
      }
    }
  } catch {
    // ignore index-list lookup errors; fallback candidates may still exist via PK
  }

  try {
    const tableInfo = db.exec(`PRAGMA table_info(${quoteIdentifier(table)})`);
    if (tableInfo.length > 0) {
      const primaryKeyColumns = [...tableInfo[0].values]
        .filter((row) => Number(row[5] ?? 0) > 0)
        .sort((a, b) => Number(a[5] ?? 0) - Number(b[5] ?? 0))
        .map((row) => String(row[1] ?? '').trim())
        .filter((column) => column.length > 0);

      addCandidate(primaryKeyColumns);
    }
  } catch {
    // ignore table-info lookup errors
  }

  return candidates;
}

function chooseConflictTarget(
  candidates: string[][],
  insertColumns: string[] | null,
): string[] | null {
  if (candidates.length === 0) return null;

  if (insertColumns && insertColumns.length > 0) {
    const insertSet = new Set(insertColumns.map((column) => column.toLowerCase()));
    const compatible = candidates.filter((candidate) =>
      candidate.every((column) => insertSet.has(column.toLowerCase())),
    );

    if (compatible.length > 0) {
      compatible.sort((a, b) => a.length - b.length);
      return compatible[0];
    }
  }

  return candidates[0];
}

function rewriteOnDuplicateKeyUpdate(sql: string, db: SqlJsDatabase): string {
  const duplicateMatch = /\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/i.exec(sql);
  if (!duplicateMatch) {
    return sql;
  }

  const insertPart = sql.slice(0, duplicateMatch.index).trimEnd();
  const updatePartRaw = sql.slice(duplicateMatch.index + duplicateMatch[0].length);
  const updatePart = updatePartRaw.replace(/;\s*$/, '').trim();
  if (!updatePart) {
    return sql;
  }

  const parsedTarget = parseInsertTarget(insertPart);
  if (!parsedTarget) {
    return sql;
  }

  const candidates = resolveUniqueConstraintCandidates(parsedTarget.table, db);
  const chosenTarget = chooseConflictTarget(candidates, parsedTarget.insertColumns);
  if (!chosenTarget) {
    return sql;
  }

  const rewrittenUpdatePart = transformSqlCodeSegments(updatePart, (segment) =>
    segment.replace(
      /\bVALUES\s*\(\s*(`[^`]+`|"[^"]+"|[A-Za-z_][\w$]*)\s*\)/gi,
      (_match, rawColumn: string) => {
        const normalizedColumn = normalizeIdentifierToken(rawColumn);
        return `excluded.${quoteIdentifier(normalizedColumn)}`;
      },
    ),
  );

  const trailingSemicolon = /;\s*$/.test(updatePartRaw) ? ';' : '';
  const conflictTarget = chosenTarget.map((column) => quoteIdentifier(column)).join(', ');
  return `${insertPart} ON CONFLICT (${conflictTarget}) DO UPDATE SET ${rewrittenUpdatePart}${trailingSemicolon}`;
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

  translated = transformSqlCodeSegments(translated, (segment) => {
    let next = segment;
    next = next.replace(/\s+ENGINE\s*=\s*\S+/gi, '');
    next = next.replace(/\s+DEFAULT\s+CHARSET\s*=\s*\S+/gi, '');
    next = next.replace(/\s+CHARSET\s*=\s*\S+/gi, '');
    next = next.replace(/\s+COLLATE\s*=\s*\S+/gi, '');
    next = next.replace(/\s+AUTO_INCREMENT\s*=\s*\d+/gi, '');
    next = next.replace(/\s+COMMENT\s*=\s*'[^']*'/gi, '');
    next = next.replace(
      /\bINT(?:EGER)?\s+AUTO_INCREMENT(?:\s+PRIMARY\s+KEY)?/gi,
      'INTEGER PRIMARY KEY AUTOINCREMENT',
    );
    next = next.replace(/\s+AUTO_INCREMENT/gi, '');
    next = next.replace(/\s+UNSIGNED/gi, '');
    next = next.replace(/\bSQL_CALC_FOUND_ROWS\b/gi, '');
    next = next.replace(/\bSQL_NO_CACHE\b/gi, '');
    next = next.replace(/\bSQL_SMALL_RESULT\b/gi, '');
    next = next.replace(/\bSQL_BIG_RESULT\b/gi, '');
    next = next.replace(/\bSQL_BUFFER_RESULT\b/gi, '');
    next = next.replace(/\bSTRAIGHT_JOIN\b/gi, 'JOIN');
    next = next.replace(/\s+FOR\s+UPDATE\b/gi, '');
    next = next.replace(/\s+LOCK\s+IN\s+SHARE\s+MODE\b/gi, '');
    next = next.replace(/\bINSERT\s+IGNORE\b/gi, 'INSERT OR IGNORE');
    next = next.replace(/\bREPLACE\s+INTO\b/gi, 'INSERT OR REPLACE INTO');
    next = next.replace(/\bLIMIT\s+(\d+)\s*,\s*(\d+)/gi, 'LIMIT $2 OFFSET $1');
    next = next.replace(/\bNVL\s*\(/gi, 'IFNULL(');
    next = next.replace(/\bDEFAULT\s+NOW\s*\(\s*\)/gi, "DEFAULT (datetime('now'))");
    next = next.replace(/\bDEFAULT\s+CURDATE\s*\(\s*\)/gi, "DEFAULT (date('now'))");
    next = next.replace(/\bDEFAULT\s+CURTIME\s*\(\s*\)/gi, "DEFAULT (time('now'))");
    next = next.replace(/\bDEFAULT\s+CURRENT_TIMESTAMP\b/gi, "DEFAULT (datetime('now'))");
    next = next.replace(/\bNOW\s*\(\s*\)/gi, "datetime('now')");
    next = next.replace(/\bCURDATE\s*\(\s*\)/gi, "date('now')");
    next = next.replace(/\bCURTIME\s*\(\s*\)/gi, "time('now')");
    next = next.replace(/\bISNULL\s*\(([^)]+)\)/gi, '($1 IS NULL)');
    next = next.replace(/\bDATABASE\s*\(\s*\)/gi, `'${activeDatabase}'`);
    next = next.replace(/\b(?:CURRENT_USER|USER)\s*\(\s*\)/gi, `'${activeUser}'`);
    next = next.replace(/\bVERSION\s*\(\s*\)/gi, 'sqlite_version()');
    return next;
  });

  translated = applyConcatCompatibilityRewrites(translated);
  translated = rewriteOnDuplicateKeyUpdate(translated, db);

  if (/^CREATE\s+(?:TEMPORARY\s+)?TABLE\b/i.test(upper)) {
    translated = rewriteCreateTableTypes(translated);
  }

  // ALTER TABLE ... MODIFY COLUMN → not fully supported, but strip MODIFY for simple cases
  // ALTER TABLE ... CHANGE COLUMN old new TYPE → ALTER TABLE ... RENAME COLUMN old TO new
  // (Limited support — SQLite ALTER TABLE is restricted)

  // Backtick → double-quote
  translated = translated.replace(/`/g, '"');

  // Rewrite MySQL ANY / SOME / ALL subquery operators → SQLite-compatible
  translated = rewriteSubqueryOperators(translated);

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
    const fkInfo = db.exec(`PRAGMA foreign_key_list("${table}")`);
    const fks: Record<string, string> = {};
    if (fkInfo.length > 0) {
      for (const row of fkInfo[0].values) {
        const fromCol = String(row[3]);
        const toTable = String(row[2]);
        const toCol = String(row[4]);
        fks[fromCol] = `FK → ${toTable}(${toCol})`;
      }
    }

    const rows: Row[] = info[0].values.map((r) => {
      const fieldName = String(r[1]);
      const isPk = r[5] === 1;
      const fkDesc = fks[fieldName];

      return {
        Field: fieldName,
        Type: r[2] || 'TEXT',
        Null: r[3] === 0 ? 'YES' : 'NO',
        Key: isPk ? 'PRI' : fkDesc ? 'MUL' : '',
        Default: r[4] ?? 'NULL',
        Extra: fkDesc ? fkDesc : '',
      };
    });
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
