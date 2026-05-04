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

function parseLeadingIdentifier(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match =
    trimmed.match(/^`([^`]+)`/) ??
    trimmed.match(/^"([^"]+)"/) ??
    trimmed.match(/^'([^']+)'/) ??
    trimmed.match(/^([A-Za-z_][\w$.]*)/);

  return match?.[1] ?? null;
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
  const match = trimmed.match(
    /^CREATE\s+TRIGGER(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s]+)\s+(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)\s+ON\s+([^\s]+)(?:\s+FOR\s+EACH\s+ROW)?\s+([\s\S]+)$/i,
  );
  if (!match) {
    return { normalized: null };
  }

  const name = match[1].trim();
  const timing = match[2].toUpperCase();
  const event = match[3].toUpperCase();
  const table = parseLeadingIdentifier(match[4]) ?? match[4].trim();
  const tail = match[5].trim();

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
      sqliteSql: `CREATE TRIGGER ${name} ${timing} ${event} ON ${table} BEGIN ${bodyStatements.join('; ')}; END;`,
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