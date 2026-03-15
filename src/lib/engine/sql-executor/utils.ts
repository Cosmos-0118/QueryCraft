import type { QueryResult, Row } from '@/types/database';

export function emptyOkResult(): QueryResult {
  return {
    columns: [],
    rows: [],
    rowCount: 0,
    executionTimeMs: 0,
  };
}

export function statusResult(rows: Row[]): QueryResult {
  return {
    columns: ['Table', 'Op', 'Msg_type', 'Msg_text'],
    rows,
    rowCount: rows.length,
    executionTimeMs: 0,
  };
}

export function stripComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}
