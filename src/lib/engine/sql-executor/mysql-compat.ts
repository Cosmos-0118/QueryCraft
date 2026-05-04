import { splitSqlStatements } from './statement-splitter';

export interface NormalizedTriggerDefinition {
  name: string;
  table: string;
  definition: string;
  sqliteSql: string;
}

export interface NormalizedTriggerDefinitionResult {
  normalized: NormalizedTriggerDefinition | null;
  error?: string;
}

export interface ExtractedCursorDefinition {
  name: string;
  query: string;
  definition: string;
}

interface ParsedIdentifierSegment {
  raw: string;
  value: string;
  nextIndex: number;
}

interface ParsedQualifiedIdentifier {
  raw: string;
  values: string[];
  nextIndex: number;
}

interface ParsedTriggerHeader {
  triggerReference: string;
  triggerName: string;
  timing: 'BEFORE' | 'AFTER';
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  tableName: string;
  tail: string;
}

function skipWhitespace(value: string, start: number): number {
  let i = start;
  while (i < value.length && /\s/.test(value[i])) i += 1;
  return i;
}

function quoteSqliteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function readIdentifierSegment(value: string, start: number): ParsedIdentifierSegment | null {
  const ch = value[start];
  if (!ch) return null;

  if (ch === '`' || ch === '"' || ch === "'") {
    let i = start + 1;
    while (i < value.length) {
      if (value[i] === ch) {
        if (value[i + 1] === ch) {
          i += 2;
          continue;
        }

        const raw = value.slice(start, i + 1);
        const inner = raw.slice(1, -1);
        const doubled = ch + ch;
        return {
          raw,
          value: inner.split(doubled).join(ch),
          nextIndex: i + 1,
        };
      }
      i += 1;
    }

    return null;
  }

  const unquoted = value.slice(start).match(/^[A-Za-z_][A-Za-z0-9_$]*/);
  if (!unquoted) return null;

  return {
    raw: unquoted[0],
    value: unquoted[0],
    nextIndex: start + unquoted[0].length,
  };
}

function readQualifiedIdentifier(
  value: string,
  start: number,
): ParsedQualifiedIdentifier | null {
  let i = skipWhitespace(value, start);
  const first = readIdentifierSegment(value, i);
  if (!first) return null;

  const values = [first.value];
  const rawParts = [first.raw];
  i = first.nextIndex;

  while (true) {
    i = skipWhitespace(value, i);
    if (value[i] !== '.') break;

    i += 1;
    i = skipWhitespace(value, i);
    const next = readIdentifierSegment(value, i);
    if (!next) return null;

    values.push(next.value);
    rawParts.push(next.raw);
    i = next.nextIndex;
  }

  return {
    raw: rawParts.join('.'),
    values,
    nextIndex: i,
  };
}

function readKeyword(value: string, start: number, keyword: string): number | null {
  const i = skipWhitespace(value, start);
  const candidate = value.slice(i, i + keyword.length);
  if (candidate.toUpperCase() !== keyword) return null;

  const next = value[i + keyword.length] ?? '';
  if (/[A-Za-z0-9_$]/.test(next)) return null;

  return i + keyword.length;
}

function parseTriggerHeader(value: string): ParsedTriggerHeader | null {
  let i = 0;

  i = readKeyword(value, i, 'CREATE') ?? -1;
  if (i < 0) return null;
  i = readKeyword(value, i, 'TRIGGER') ?? -1;
  if (i < 0) return null;

  const afterIf = readKeyword(value, i, 'IF');
  if (afterIf !== null) {
    const afterNot = readKeyword(value, afterIf, 'NOT');
    const afterExists = afterNot !== null ? readKeyword(value, afterNot, 'EXISTS') : null;
    if (afterExists !== null) {
      i = afterExists;
    }
  }

  const trigger = readQualifiedIdentifier(value, i);
  if (!trigger || trigger.values.length === 0) return null;
  i = trigger.nextIndex;

  let timing: 'BEFORE' | 'AFTER' | null = null;
  const afterBefore = readKeyword(value, i, 'BEFORE');
  if (afterBefore !== null) {
    timing = 'BEFORE';
    i = afterBefore;
  } else {
    const afterAfter = readKeyword(value, i, 'AFTER');
    if (afterAfter !== null) {
      timing = 'AFTER';
      i = afterAfter;
    }
  }
  if (!timing) return null;

  let event: 'INSERT' | 'UPDATE' | 'DELETE' | null = null;
  const afterInsert = readKeyword(value, i, 'INSERT');
  if (afterInsert !== null) {
    event = 'INSERT';
    i = afterInsert;
  } else {
    const afterUpdate = readKeyword(value, i, 'UPDATE');
    if (afterUpdate !== null) {
      event = 'UPDATE';
      i = afterUpdate;
    } else {
      const afterDelete = readKeyword(value, i, 'DELETE');
      if (afterDelete !== null) {
        event = 'DELETE';
        i = afterDelete;
      }
    }
  }
  if (!event) return null;

  i = readKeyword(value, i, 'ON') ?? -1;
  if (i < 0) return null;

  const table = readQualifiedIdentifier(value, i);
  if (!table || table.values.length === 0) return null;
  i = table.nextIndex;

  const afterFor = readKeyword(value, i, 'FOR');
  if (afterFor !== null) {
    const afterEach = readKeyword(value, afterFor, 'EACH');
    const afterRow = afterEach !== null ? readKeyword(value, afterEach, 'ROW') : null;
    if (afterRow !== null) {
      i = afterRow;
    }
  }

  const tail = value.slice(i).trim();
  if (!tail) return null;

  return {
    triggerReference: trigger.raw,
    triggerName: trigger.values[trigger.values.length - 1],
    timing,
    event,
    tableName: table.values[table.values.length - 1],
    tail,
  };
}

/**
 * Translate MySQL-specific function calls in trigger body statements
 * to their SQLite equivalents so the trigger can execute at the SQLite level.
 */
function translateTriggerBodyFunctions(sql: string): string {
  let result = sql;
  result = result.replace(/\bNOW\s*\(\s*\)/gi, "datetime('now')");
  result = result.replace(/\bCURDATE\s*\(\s*\)/gi, "date('now')");
  result = result.replace(/\bCURTIME\s*\(\s*\)/gi, "time('now')");
  result = result.replace(/\bCURRENT_TIMESTAMP\s*\(\s*\)/gi, "datetime('now')");
  result = result.replace(/\bSYSDATE\s*\(\s*\)/gi, "datetime('now')");
  result = result.replace(/\bUNIX_TIMESTAMP\s*\(\s*\)/gi, "strftime('%s','now')");
  return result;
}

function classifyUnsupportedTriggerStatement(statement: string): string | null {
  const trimmed = statement.trim().replace(/;$/, '').trim();
  if (!trimmed) return null;

  if (/^SET\s+NEW\./i.test(trimmed) || /^SET\s+OLD\./i.test(trimmed)) {
    return "SET NEW./OLD. assignments are not supported by the SQLite trigger backend. Use explicit SQL expressions that do not mutate NEW/OLD records directly.";
  }

  if (/^(IF|ELSEIF|ELSE|END\s+IF|LOOP|WHILE|CASE|DECLARE)\b/i.test(trimmed)) {
    return 'Control-flow trigger bodies (IF/ELSE/LOOP/DECLARE) are not supported in SQLite trigger compatibility mode.';
  }

  return null;
}

export function normalizeMySqlTriggerDefinition(
  rawSql: string,
): NormalizedTriggerDefinitionResult {
  const trimmed = rawSql.trim().replace(/;$/, '').trim();
  const parsedHeader = parseTriggerHeader(trimmed);
  if (!parsedHeader) {
    return { normalized: null };
  }

  const name = parsedHeader.triggerReference;
  const timing = parsedHeader.timing;
  const event = parsedHeader.event;
  const table = parsedHeader.tableName;
  const tail = parsedHeader.tail;

  const blockMatch = tail.match(/^BEGIN\s+([\s\S]*)\s+END$/i);
  const bodySource = blockMatch ? blockMatch[1] : tail;
  const parsedStatements = splitSqlStatements(bodySource)
    .map((statement) => statement.trim().replace(/;$/, '').trim())
    .filter(Boolean);

  const bodyStatements: string[] = [];
  for (const statement of parsedStatements) {
    const unsupportedReason = classifyUnsupportedTriggerStatement(statement);
    if (unsupportedReason) {
      return {
        normalized: null,
        error: `Unsupported trigger definition for '${name}': ${unsupportedReason}`,
      };
    }
    bodyStatements.push(translateTriggerBodyFunctions(statement));
  }

  if (bodyStatements.length === 0) {
    return {
      normalized: null,
      error: 'Trigger body is empty or could not be normalized.',
    };
  }

  return {
    normalized: {
      name,
      table,
      definition: trimmed,
      sqliteSql: `CREATE TRIGGER ${quoteSqliteIdentifier(parsedHeader.triggerName)} ${timing} ${event} ON ${quoteSqliteIdentifier(table)} BEGIN ${bodyStatements.join('; ')}; END;`,
    },
  };
}

export function extractCursorDefinitions(body: string): ExtractedCursorDefinition[] {
  return splitSqlStatements(body)
    .map((statement) => statement.trim().replace(/;$/, '').trim())
    .map((statement) => {
      const mysqlCursor = statement.match(/^DECLARE\s+(\w+)\s+CURSOR\s+FOR\s+([\s\S]+)$/i);
      if (mysqlCursor) {
        return {
          name: mysqlCursor[1],
          query: mysqlCursor[2].trim(),
          definition: statement,
        } satisfies ExtractedCursorDefinition;
      }

      const plSqlCursor = statement.match(/^CURSOR\s+(\w+)\s+IS\s+([\s\S]+)$/i);
      if (!plSqlCursor) {
        return null;
      }

      return {
        name: plSqlCursor[1],
        query: plSqlCursor[2].trim(),
        definition: statement,
      } satisfies ExtractedCursorDefinition;
    })
    .filter((cursor): cursor is ExtractedCursorDefinition => cursor !== null);
}