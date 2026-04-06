import { splitSqlStatements } from './statement-splitter';

export interface NormalizedTriggerDefinition {
  name: string;
  table: string;
  definition: string;
  sqliteSql: string;
}

export interface ExtractedCursorDefinition {
  name: string;
  query: string;
  definition: string;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
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

function rewriteTriggerBodyStatement(statement: string, table: string, extraCondition?: string): string {
  const trimmed = statement.trim().replace(/;$/, '').trim();
  if (!trimmed) return '';

  const setNewMatch = trimmed.match(/^SET\s+NEW\.(\w+)\s*=\s*([\s\S]+)$/i);
  if (!setNewMatch) {
    return trimmed;
  }

  const where = extraCondition
    ? `WHERE rowid = NEW.rowid AND (${extraCondition})`
    : 'WHERE rowid = NEW.rowid';
  return `UPDATE ${quoteIdentifier(table)} SET ${quoteIdentifier(setNewMatch[1])} = ${setNewMatch[2].trim()} ${where}`;
}

function flattenTriggerIfBlocks(bodySource: string): string {
  // Replaces IF cond THEN stmts END IF with the inner stmts annotated with the condition.
  // Uses a marker so the caller can attach the condition to WHERE clauses.
  return bodySource.replace(
    /IF\s+([\s\S]+?)\s+THEN\s+([\s\S]+?)\s+END\s+IF/gi,
    (_m, cond: string, body: string) => {
      // Tag each inner statement with a condition marker
      const stmts = body
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      return stmts.map((s) => `/*IF:${cond.trim()}*/ ${s}`).join(';\n');
    },
  );
}

export function normalizeMySqlTriggerDefinition(rawSql: string): NormalizedTriggerDefinition | null {
  const trimmed = rawSql.trim().replace(/;$/, '').trim();
  const match = trimmed.match(
    /^CREATE\s+TRIGGER(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s]+)\s+(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)\s+ON\s+([^\s]+)(?:\s+FOR\s+EACH\s+ROW)?\s+([\s\S]+)$/i,
  );
  if (!match) {
    return null;
  }

  const name = match[1].trim();
  const originalTiming = match[2].toUpperCase();
  const event = match[3].toUpperCase();
  const table = parseLeadingIdentifier(match[4]) ?? match[4].trim();
  const tail = match[5].trim();

  const blockMatch = tail.match(/^BEGIN\s+([\s\S]*)\s+END$/i);
  const bodySource = blockMatch ? blockMatch[1] : tail;
  const flattened = flattenTriggerIfBlocks(bodySource);
  const bodyStatements = splitSqlStatements(flattened)
    .map((statement) => {
      const condMatch = statement.match(/^\/\*IF:([\s\S]+?)\*\/\s*([\s\S]+)$/);
      if (condMatch) {
        return rewriteTriggerBodyStatement(condMatch[2], table, condMatch[1].trim());
      }
      return rewriteTriggerBodyStatement(statement, table);
    })
    .filter(Boolean);

  let timing = originalTiming;
  if (bodyStatements.some((statement) => /^UPDATE\s+/i.test(statement)) && originalTiming === 'BEFORE') {
    timing = 'AFTER';
  }

  return {
    name,
    table,
    definition: trimmed,
    sqliteSql: `CREATE TRIGGER ${name} ${timing} ${event} ON ${table} BEGIN ${bodyStatements.join('; ')}; END;`,
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