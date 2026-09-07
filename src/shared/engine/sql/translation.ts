import type { SqlJsDatabase, TranslatedQuery } from './types';
import { emptyOkResult, statusResult, stripComments } from './utils';
import { rewriteSubqueryOperators } from './subquery-rewriter';
import { transformSqlCodeSegments } from './sql-lexer';
import { quoteSqlLiteral } from './sql-structure-utils';

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

function applyConcatWsCompatibilityRewrites(sql: string): string {
  let rewritten = sql;
  while (true) {
    const next = rewriteFunctionCalls(rewritten, ['CONCAT_WS'], (_fnName, argument) => {
      const parts = splitTopLevelComma(argument)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      if (parts.length === 0) return "''";
      if (parts.length === 1) return parts[0];
      const separator = parts[0];
      const values = parts.slice(1);
      // MySQL CONCAT_WS skips NULLs; approximate with nested COALESCE chains joined by separator.
      // Each value becomes COALESCE(value, '') so NULLs contribute empty strings.
      const coalesced = values.map((value) => `COALESCE((${value}), '')`);
      return coalesced.join(` || ${separator} || `);
    });
    if (next === rewritten) return next;
    rewritten = next;
  }
}

function applyGroupConcatCompatibilityRewrites(sql: string): string {
  return rewriteFunctionCalls(sql, ['GROUP_CONCAT'], (_fnName, argument) => {
    let arg = argument.trim();
    let separator: string | null = null;
    const sepMatch = arg.match(/^(.*?)\s+SEPARATOR\s+('(?:''|[^'])*'|"(?:\"\"|[^\"])*")\s*$/i);
    if (sepMatch) {
      arg = sepMatch[1].trim();
      separator = sepMatch[2].trim();
    }
    // Strip ORDER BY inside GROUP_CONCAT (SQLite group_concat doesn't support it).
    // Keep DISTINCT if present.
    arg = arg.replace(/\s+ORDER\s+BY\s+[\s\S]+$/i, '').trim();
    if (!arg) return separator ? `group_concat('', ${separator})` : `group_concat('')`;
    if (separator) return `group_concat(${arg}, ${separator})`;
    return `group_concat(${arg})`;
  });
}

function applyIfCompatibilityRewrites(sql: string): string {
  // IF(cond, a, b) -> IIF(cond, a, b). Avoid matching IFNULL/IF NULL variants.
  return transformSqlCodeSegments(sql, (segment) =>
    segment.replace(/\bIF\s*\(/gi, 'IIF('),
  );
}

function applyDateCompatibilityRewrites(sql: string): string {
  let rewritten = rewriteFunctionCalls(
    sql,
    ['YEAR', 'MONTH', 'DAY', 'DAYOFMONTH', 'HOUR', 'MINUTE', 'SECOND', 'WEEK', 'QUARTER'],
    (fnName, argument) => {
      const arg = argument.trim() || 'NULL';
      switch (fnName) {
        case 'YEAR':
          return `CAST(strftime('%Y', ${arg}) AS INTEGER)`;
        case 'MONTH':
          return `CAST(strftime('%m', ${arg}) AS INTEGER)`;
        case 'DAY':
        case 'DAYOFMONTH':
          return `CAST(strftime('%d', ${arg}) AS INTEGER)`;
        case 'HOUR':
          return `CAST(strftime('%H', ${arg}) AS INTEGER)`;
        case 'MINUTE':
          return `CAST(strftime('%M', ${arg}) AS INTEGER)`;
        case 'SECOND':
          return `CAST(strftime('%S', ${arg}) AS INTEGER)`;
        case 'QUARTER':
          return `CAST((CAST(strftime('%m', ${arg}) AS INTEGER) + 2) / 3 AS INTEGER)`;
        case 'WEEK':
          return `CAST(strftime('%W', ${arg}) AS INTEGER)`;
        default:
          return `${fnName}(${arg})`;
      }
    },
  );
  rewritten = rewriteFunctionCalls(rewritten, ['DATEDIFF'], (_fnName, argument) => {
    const parts = splitTopLevelComma(argument);
    if (parts.length !== 2) return `DATEDIFF(${argument})`;
    return `CAST(julianday(${parts[0].trim()}) - julianday(${parts[1].trim()}) AS INTEGER)`;
  });
  rewritten = rewriteFunctionCalls(
    rewritten,
    ['DATE_ADD', 'DATE_SUB', 'ADDDATE', 'SUBDATE', 'TIMESTAMPADD'],
    (fnName, argument) => {
      const parts = splitTopLevelComma(argument);
      const upper = fnName.toUpperCase();
      const isAdd = upper === 'DATE_ADD' || upper === 'ADDDATE' || upper === 'TIMESTAMPADD';
      if (parts.length < 2) return `${fnName}(${argument})`;
      const base = parts[0].trim();
      const intervalRaw = parts.slice(1).join(',').trim();
      const intervalMatch = intervalRaw.match(/^INTERVAL\s+('(?:''|[^'])*'|-?\d+(?:\.\d+)?)\s+([A-Za-z_]+)\s*$/i);
      let amount = intervalMatch?.[1] ?? '';
      let unit = (intervalMatch?.[2] ?? '').toLowerCase();
      if (!intervalMatch) {
        // ADDDATE(d, n) / SUBDATE(d, n) day-shorthand form.
        amount = intervalRaw;
        unit = 'day';
      }
      const plural: Record<string, string> = {
        microsecond: 'seconds',
        second: 'seconds',
        minute: 'minutes',
        hour: 'hours',
        day: 'days',
        week: 'weeks',
        month: 'months',
        quarter: 'months',
        year: 'years',
      };
      let modifierUnit = plural[unit] ?? plural[unit.replace(/s$/, '')] ?? 'days';
      let numericAmount = amount;
      const quoted = amount.match(/^'(.*)'$/);
      if (quoted) numericAmount = quoted[1].replace(/''/g, "'");
      if (unit === 'quarter' && /^-?\d/.test(numericAmount)) {
        numericAmount = `(${numericAmount} * 3)`;
      }
      if (unit === 'week' && /^-?\d/.test(numericAmount)) {
        numericAmount = `(${numericAmount} * 7)`;
        modifierUnit = 'days';
      }
      const sign = isAdd ? '+' : '-';
      return `datetime(${base}, '${sign}' || (${numericAmount}) || ' ${modifierUnit}')`;
    },
  );
  return rewritten;
}

function applyMiscFunctionRewrites(sql: string): string {
  return rewriteFunctionCalls(
    sql,
    ['SYSDATE', 'UTC_TIMESTAMP', 'LOCALTIME', 'LOCALTIMESTAMP', 'UNIX_TIMESTAMP', 'FROM_UNIXTIME'],
    (fnName, argument) => {
      const arg = argument.trim();
      switch (fnName) {
        case 'SYSDATE':
        case 'UTC_TIMESTAMP':
        case 'LOCALTIME':
        case 'LOCALTIMESTAMP':
          return `datetime('now')`;
        case 'UNIX_TIMESTAMP':
          return arg ? `CAST(strftime('%s', ${arg}) AS INTEGER)` : `CAST(strftime('%s','now') AS INTEGER)`;
        case 'FROM_UNIXTIME':
          return arg ? `datetime(${arg}, 'unixepoch')` : `datetime('now')`;
        default:
          return `${fnName}(${arg})`;
      }
    },
  );
}

function applyIsNullCompatibilityRewrites(sql: string): string {
  // Paren-depth aware (unlike a naive [^)]+ regex), so ISNULL(COALESCE(a,b))
  // translates correctly instead of stopping at the first ')'.
  return rewriteFunctionCalls(sql, ['ISNULL'], (_fnName, argument) => `(${argument} IS NULL)`);
}

const MYSQL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MYSQL_WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function sqlCaseNameLookup(strftimeExpr: string, names: readonly string[], oneIndexed: boolean): string {
  const whens = names
    .map((name, i) => `WHEN ${oneIndexed ? i + 1 : i} THEN '${name.replace(/'/g, "''")}'`)
    .join(' ');
  return `(CASE CAST(${strftimeExpr} AS INTEGER) ${whens} END)`;
}

/**
 * Translate a MySQL DATE_FORMAT() literal format string into a SQL expression
 * built from SQLite strftime()/CASE fragments. Only literal (single-quoted)
 * format strings are handled — a dynamic format argument is left untranslated
 * (it will fail loudly at execution rather than silently mis-format).
 */
function translateDateFormatCall(dateArg: string, formatLiteral: string): string | null {
  const literalMatch = formatLiteral.match(/^'((?:''|[^'])*)'$/);
  if (!literalMatch) return null;
  const format = literalMatch[1].replace(/''/g, "'");

  const parts: string[] = [];
  let literalBuf = '';
  const flushLiteral = () => {
    if (literalBuf) {
      parts.push(quoteSqlLiteral(literalBuf));
      literalBuf = '';
    }
  };

  for (let i = 0; i < format.length; i += 1) {
    const ch = format[i];
    if (ch !== '%' || i === format.length - 1) {
      literalBuf += ch;
      continue;
    }
    const spec = format[i + 1];
    i += 1;
    let expr: string | null;
    switch (spec) {
      case 'Y':
        expr = `strftime('%Y', ${dateArg})`;
        break;
      case 'y':
        expr = `substr(strftime('%Y', ${dateArg}), 3, 2)`;
        break;
      case 'm':
        expr = `strftime('%m', ${dateArg})`;
        break;
      case 'c':
        expr = `CAST(strftime('%m', ${dateArg}) AS TEXT)`;
        break;
      case 'd':
        expr = `strftime('%d', ${dateArg})`;
        break;
      case 'e':
        expr = `CAST(strftime('%d', ${dateArg}) AS TEXT)`;
        break;
      case 'H':
        expr = `strftime('%H', ${dateArg})`;
        break;
      case 'h':
      case 'I':
        expr = `printf('%02d', ((CAST(strftime('%H', ${dateArg}) AS INTEGER) + 11) % 12) + 1)`;
        break;
      case 'i':
        expr = `strftime('%M', ${dateArg})`;
        break;
      case 's':
      case 'S':
        expr = `strftime('%S', ${dateArg})`;
        break;
      case 'p':
        expr = `(CASE WHEN CAST(strftime('%H', ${dateArg}) AS INTEGER) < 12 THEN 'AM' ELSE 'PM' END)`;
        break;
      case 'j':
        expr = `strftime('%j', ${dateArg})`;
        break;
      case 'w':
        expr = `strftime('%w', ${dateArg})`;
        break;
      case 'M':
        expr = sqlCaseNameLookup(`strftime('%m', ${dateArg})`, MYSQL_MONTH_NAMES, true);
        break;
      case 'b':
        expr = sqlCaseNameLookup(
          `strftime('%m', ${dateArg})`,
          MYSQL_MONTH_NAMES.map((n) => n.slice(0, 3)),
          true,
        );
        break;
      case 'W':
        expr = sqlCaseNameLookup(`strftime('%w', ${dateArg})`, MYSQL_WEEKDAY_NAMES, false);
        break;
      case 'a':
        expr = sqlCaseNameLookup(
          `strftime('%w', ${dateArg})`,
          MYSQL_WEEKDAY_NAMES.map((n) => n.slice(0, 3)),
          false,
        );
        break;
      case '%':
        literalBuf += '%';
        continue;
      default:
        // Unsupported specifier (%U/%u/%V/%v/%X/%x week-numbering and others) —
        // bail out rather than silently drop it; caller leaves the call untranslated.
        return null;
    }
    flushLiteral();
    parts.push(expr);
  }
  flushLiteral();

  if (parts.length === 0) return "''";
  return parts.join(' || ');
}

function applyDateFormatCompatibilityRewrites(sql: string): string {
  return rewriteFunctionCalls(sql, ['DATE_FORMAT'], (fnName, argument) => {
    const parts = splitTopLevelComma(argument);
    if (parts.length !== 2) return `${fnName}(${argument})`;
    const translated = translateDateFormatCall(parts[0].trim(), parts[1].trim());
    return translated ?? `${fnName}(${argument})`;
  });
}

interface StrToDateField {
  key: 'Y' | 'y' | 'm' | 'd' | 'H' | 'i' | 's';
  width: number;
}

const STR_TO_DATE_FIELD_WIDTH: Record<StrToDateField['key'], number> = {
  Y: 4,
  y: 2,
  m: 2,
  d: 2,
  H: 2,
  i: 2,
  s: 2,
};

/**
 * Translate STR_TO_DATE(str, format) for a literal, fixed-width MySQL format
 * string (e.g. '%Y-%m-%d %H:%i:%s') into a SQL expression that reassembles an
 * ISO-8601 string via substr() on fixed character offsets. Formats containing
 * variable-width or name-based specifiers (%c, %e, %M, %b, %W, %a, %p, ...)
 * are not representable this way and are left untranslated.
 */
function translateStrToDateCall(strArg: string, formatLiteral: string): string | null {
  const literalMatch = formatLiteral.match(/^'((?:''|[^'])*)'$/);
  if (!literalMatch) return null;
  const format = literalMatch[1].replace(/''/g, "'");

  const fields: { key: StrToDateField['key']; offset: number }[] = [];
  let offset = 1; // SQL substr() is 1-indexed

  for (let i = 0; i < format.length; i += 1) {
    const ch = format[i];
    if (ch !== '%' || i === format.length - 1) {
      offset += 1;
      continue;
    }
    const spec = format[i + 1] as StrToDateField['key'] | '%';
    i += 1;
    if (spec === '%') {
      offset += 1;
      continue;
    }
    const width = STR_TO_DATE_FIELD_WIDTH[spec as StrToDateField['key']];
    if (!width) return null; // unsupported/variable-width specifier
    fields.push({ key: spec as StrToDateField['key'], offset });
    offset += width;
  }

  const extract = (key: StrToDateField['key']): string | null => {
    const field = fields.find((f) => f.key === key);
    if (!field) return null;
    return `substr(${strArg}, ${field.offset}, ${STR_TO_DATE_FIELD_WIDTH[key]})`;
  };

  const year = extract('Y') ?? (extract('y') ? `('20' || ${extract('y')})` : null);
  if (!year) return null; // no representable year field — can't build a valid date
  const month = extract('m') ?? "'01'";
  const day = extract('d') ?? "'01'";
  const hour = extract('H');
  const minute = extract('i');
  const second = extract('s');

  const datePart = `(${year} || '-' || ${month} || '-' || ${day})`;
  if (!hour && !minute && !second) return datePart;
  const timePart = `(${hour ?? "'00'"} || ':' || ${minute ?? "'00'"} || ':' || ${second ?? "'00'"})`;
  return `(${datePart} || ' ' || ${timePart})`;
}

function applyStrToDateCompatibilityRewrites(sql: string): string {
  return rewriteFunctionCalls(sql, ['STR_TO_DATE'], (fnName, argument) => {
    const parts = splitTopLevelComma(argument);
    if (parts.length !== 2) return `${fnName}(${argument})`;
    const translated = translateStrToDateCall(parts[0].trim(), parts[1].trim());
    return translated ?? `${fnName}(${argument})`;
  });
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

  // NOTE: SHOW DATABASES, SHOW TABLES, SHOW COLUMNS/FIELDS, DESCRIBE/DESC/EXPLAIN,
  // SHOW CREATE TABLE, SHOW INDEX/INDEXES/KEYS, and SHOW TABLE STATUS are all handled
  // earlier in the pipeline by handleDatabaseCommand() (internal/database-commands.ts),
  // which runs before translateMySQL(). Do not re-add handlers for these here — a
  // second, divergent implementation is unreachable under normal input but becomes a
  // silent-fallback hazard the moment a database-commands.ts regex fails to match an
  // edge-case form (see docs/mysql-compat-limitations.md).

  // SHOW WARNINGS / SHOW ERRORS — no-op for SQLite
  if (/^SHOW\s+(COUNT\s*\(\s*\*\s*\)\s+)?(WARNINGS|ERRORS)\s*;?$/i.test(norm)) {
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

  // NOTE: SHOW CREATE DATABASE is handled earlier by handleDatabaseCommand()
  // (internal/database-commands.ts:671) — do not duplicate it here.

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
            State: 'simulated — no real server process list is tracked',
            Info: null,
          },
        ],
        rowCount: 1,
        executionTimeMs: 0,
      },
    };
  }
  if (/^SHOW\s+(GLOBAL\s+|SESSION\s+)?VARIABLES/i.test(norm)) {
    const likeMatch = norm.match(/\bLIKE\s+'((?:''|[^'])*)'/i);
    const likePattern = likeMatch?.[1]?.replace(/''/g, "'");
    const likeTest = (value: string): boolean => {
      if (!likePattern) return true;
      const regex = new RegExp(
        `^${likePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`,
        'i',
      );
      return regex.test(value);
    };
    const allRows = [
      { Variable_name: 'version', Value: 'SQLite (WASM) — MySQL-compatible mode' },
      { Variable_name: 'max_connections', Value: '1' },
      { Variable_name: 'character_set_server', Value: 'utf8mb4' },
      { Variable_name: 'collation_server', Value: 'utf8mb4_general_ci' },
      { Variable_name: 'autocommit', Value: '1' },
      { Variable_name: 'foreign_key_checks', Value: '1' },
      {
        Variable_name: 'querycraft_emulation_notice',
        Value: 'Static placeholders — not live server state',
      },
    ].filter((row) => likeTest(row.Variable_name));
    return {
      sql: null,
      result: {
        columns: ['Variable_name', 'Value'],
        rows: allRows,
        rowCount: allRows.length,
        executionTimeMs: 0,
      },
    };
  }
  if (/^SHOW\s+(GLOBAL\s+|SESSION\s+)?STATUS/i.test(norm)) {
    const likeMatch = norm.match(/\bLIKE\s+'((?:''|[^'])*)'/i);
    const likePattern = likeMatch?.[1]?.replace(/''/g, "'");
    const likeTest = (value: string): boolean => {
      if (!likePattern) return true;
      const regex = new RegExp(
        `^${likePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`,
        'i',
      );
      return regex.test(value);
    };
    const allRows = [
      { Variable_name: 'Uptime', Value: '0' },
      {
        Variable_name: 'querycraft_emulation_notice',
        Value: 'Status counters are not tracked; values are static placeholders',
      },
    ].filter((row) => likeTest(row.Variable_name));
    return {
      sql: null,
      result: {
        columns: ['Variable_name', 'Value'],
        rows: allRows,
        rowCount: allRows.length,
        executionTimeMs: 0,
      },
    };
  }
  if (/^SHOW\s+PRIVILEGES\s*;?$/i.test(norm)) {
    return {
      sql: null,
      result: {
        columns: ['Privilege', 'Context', 'Comment'],
        rows: [
          { Privilege: 'Select', Context: 'Tables', Comment: 'To select rows from tables' },
          { Privilege: 'Insert', Context: 'Tables', Comment: 'To insert rows into tables' },
          { Privilege: 'Update', Context: 'Tables', Comment: 'To update rows in tables' },
          { Privilege: 'Delete', Context: 'Tables', Comment: 'To delete rows from tables' },
          { Privilege: 'Create', Context: 'Databases,Tables,Indexes', Comment: 'To create databases, tables and indexes' },
          { Privilege: 'Drop', Context: 'Databases,Tables', Comment: 'To drop databases and tables' },
          { Privilege: 'Alter', Context: 'Tables', Comment: 'To alter tables' },
          { Privilege: 'Index', Context: 'Tables', Comment: 'To create and drop indexes' },
          { Privilege: 'Execute', Context: 'Functions,Procedures', Comment: 'To execute stored routines' },
        ],
        rowCount: 9,
        executionTimeMs: 0,
      },
    };
  }
  if (/^SHOW\s+ENGINE\s+\w+\s+STATUS\s*;?$/i.test(norm)) {
    return {
      sql: null,
      result: {
        columns: ['Type', 'Name', 'Status'],
        rows: [{ Type: 'SQLite', Name: 'WASM backend', Status: '' }],
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

  // MySQL TABLE t shorthand → SELECT * FROM t
  {
    const m = norm.match(/^TABLE\s+[`"']?([\w$]+)[`"']?\s*;?$/i);
    if (m) {
      return { sql: `SELECT * FROM "${m[1]}"` };
    }
  }

  // MySQL DROP INDEX idx ON tbl → SQLite DROP INDEX idx
  {
    const m = norm.match(/^DROP\s+INDEX\s+[`"']?([\w$]+)[`"']?\s+ON\s+[`"']?([\w$]+)[`"']?\s*;?$/i);
    if (m) {
      return { sql: `DROP INDEX IF EXISTS "${m[1]}"` };
    }
  }

  // CREATE OR REPLACE VIEW → strip OR REPLACE (SQLite lacks it); best-effort for new views.
  // Existing-view replacement is handled by attempting DROP first at execution time is out of
  // scope for a single-string translation, so we degrade to plain CREATE VIEW here and let
  // callers retry semantics surface naturally.
  // NOTE: handled below via regex on translated text as well for TEMPORARY variants.

  // INSERT ... SET col = val, ... → INSERT INTO t (cols) VALUES (vals)
  {
    const m = cleaned.match(
      /^\s*INSERT\s+(?:LOW_PRIORITY\s+|DELAYED\s+|HIGH_PRIORITY\s+)?(?:IGNORE\s+)?(?:INTO\s+)?((?:`[^`]+`|"[^"]+"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:`[^`]+`|"[^"]+"|[A-Za-z_][\w$]*))?)\s+SET\s+([\s\S]+?)\s*;?\s*$/i,
    );
    if (m && !/\bSELECT\b/i.test(m[2])) {
      const target = m[1].trim();
      const assignments = splitTopLevelComma(m[2]);
      const columns: string[] = [];
      const values: string[] = [];
      let valid = assignments.length > 0;
      for (const assignment of assignments) {
        const eq = assignment.match(/^([\s\S]+?)\s*=\s*([\s\S]+)$/);
        if (!eq) {
          valid = false;
          break;
        }
        columns.push(eq[1].trim());
        values.push(eq[2].trim());
      }
      if (valid) {
        const ignore = /\bINSERT\s+(?:LOW_PRIORITY\s+|DELAYED\s+|HIGH_PRIORITY\s+)?IGNORE\b/i.test(
          cleaned,
        )
          ? 'OR IGNORE '
          : '';
        return { sql: `INSERT ${ignore}INTO ${target} (${columns.join(', ')}) VALUES (${values.join(', ')})` };
      }
    }
  }

  // ENGINE=... / DEFAULT CHARSET=... / AUTO_INCREMENT — strip MySQL-specific clauses
  let translated = cleaned;

  // CREATE OR REPLACE VIEW/TABLE early normalization (outside string literals).
  translated = transformSqlCodeSegments(translated, (segment) =>
    segment.replace(/\bCREATE\s+OR\s+REPLACE\s+(VIEW|TABLE|TRIGGER|PROCEDURE)\b/gi, 'CREATE $1'),
  );

  translated = transformSqlCodeSegments(translated, (segment) => {
    let next = segment;
    next = next.replace(/\s+ENGINE\s*=\s*\S+/gi, '');
    next = next.replace(/\s+DEFAULT\s+CHARSET\s*=\s*\S+/gi, '');
    next = next.replace(/\s+CHARSET\s*=\s*\S+/gi, '');
    next = next.replace(/\s+COLLATE\s*=\s*\S+/gi, '');
    next = next.replace(/\s+AUTO_INCREMENT\s*=\s*\d+/gi, '');
    next = next.replace(/\s+COMMENT\s*=\s*'[^']*'/gi, '');
    next = next.replace(
      /\b(?:INT(?:EGER)?|BIGINT|SMALLINT|MEDIUMINT|TINYINT)(?:\s+UNSIGNED)?\s+AUTO_INCREMENT(?:\s+PRIMARY\s+KEY)?/gi,
      'INTEGER PRIMARY KEY AUTOINCREMENT',
    );
    next = next.replace(/\s+AUTO_INCREMENT/gi, '');
    next = next.replace(/\s+UNSIGNED/gi, '');
    // Per-column MySQL attributes with no SQLite equivalent.
    next = next.replace(/\s+ZEROFILL\b/gi, '');
    next = next.replace(/\s+BINARY\b(?!\s*\(\s*\d)/gi, '');
    next = next.replace(/\s+CHARACTER\s+SET\s+[A-Za-z0-9_]+\b/gi, '');
    next = next.replace(/\s+COLLATE\s+[A-Za-z0-9_]+\b/gi, '');
    next = next.replace(/\s+COMMENT\s+'[^']*'/gi, '');
    next = next.replace(/\s+ROW_FORMAT\s*=\s*\w+/gi, '');
    next = next.replace(/\s+KEY_BLOCK_SIZE\s*=\s*\S+/gi, '');
    next = next.replace(/\bSQL_CALC_FOUND_ROWS\b/gi, '');
    next = next.replace(/\bSQL_NO_CACHE\b/gi, '');
    next = next.replace(/\bSQL_SMALL_RESULT\b/gi, '');
    next = next.replace(/\bSQL_BIG_RESULT\b/gi, '');
    next = next.replace(/\bSQL_BUFFER_RESULT\b/gi, '');
    next = next.replace(/\bSTRAIGHT_JOIN\b/gi, 'JOIN');
    next = next.replace(/\s+FOR\s+UPDATE\b/gi, '');
    next = next.replace(/\s+LOCK\s+IN\s+SHARE\s+MODE\b/gi, '');
    next = next.replace(/\bINSERT\s+(?:LOW_PRIORITY\s+|DELAYED\s+|HIGH_PRIORITY\s+)?IGNORE\b/gi, 'INSERT OR IGNORE');
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
    next = next.replace(/\bDATABASE\s*\(\s*\)/gi, quoteSqlLiteral(activeDatabase));
    next = next.replace(/\b(?:CURRENT_USER|USER)\s*\(\s*\)/gi, quoteSqlLiteral(activeUser));
    next = next.replace(/\bVERSION\s*\(\s*\)/gi, 'sqlite_version()');
    // MySQL operators with no direct SQLite spelling.
    next = next.replace(/<=>/g, ' IS ');
    next = next.replace(/&&/g, ' AND ');
    // `||` is string concatenation in SQLite but logical OR in MySQL's default mode.
    // Our own CONCAT rewrite below reintroduces `||` after this step, so translate user
    // `||` to OR here first.
    next = next.replace(/\|\|/g, ' OR ');
    next = next.replace(/([)\w'"\d`])\s+\bMOD\b\s+([(\w'"\d`])/gi, '$1 % $2');
    next = next.replace(/([)\w'"\d`])\s+\bDIV\b\s+([(\w'"\d`])/gi, '$1 / $2');
    return next;
  });

  translated = applyConcatCompatibilityRewrites(translated);
  translated = applyConcatWsCompatibilityRewrites(translated);
  translated = applyGroupConcatCompatibilityRewrites(translated);
  translated = applyIfCompatibilityRewrites(translated);
  translated = applyIsNullCompatibilityRewrites(translated);
  translated = applyDateCompatibilityRewrites(translated);
  translated = applyDateFormatCompatibilityRewrites(translated);
  translated = applyStrToDateCompatibilityRewrites(translated);
  translated = applyMiscFunctionRewrites(translated);
  translated = rewriteOnDuplicateKeyUpdate(translated, db);

  if (/^CREATE\s+(?:TEMPORARY\s+)?TABLE\b/i.test(upper)) {
    translated = rewriteCreateTableTypes(translated);
  }

  // ALTER TABLE ... MODIFY COLUMN → not fully supported, but strip MODIFY for simple cases
  // ALTER TABLE ... CHANGE COLUMN old new TYPE → ALTER TABLE ... RENAME COLUMN old TO new
  // (Limited support — SQLite ALTER TABLE is restricted)

  // Backtick → double-quote (identifiers only; never inside string literals).
  translated = transformSqlCodeSegments(translated, (segment) => segment.replace(/`/g, '"'));

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
