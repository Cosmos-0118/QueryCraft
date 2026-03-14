import type { QueryResult } from '@/types/database';
import type { SqlErrorCategory, SqlErrorDetails } from '@/types/sql-error';

interface BuildOptions {
  sql: string;
  translatedSql?: string;
  startTime: number;
}

interface Classification {
  code: string;
  category: SqlErrorCategory;
  title: string;
  message: string;
  hint?: string;
  recoverable: boolean;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parsePosition(rawMessage: string, sql: string) {
  const positionMatch = rawMessage.match(/at position\s+(\d+)/i);
  if (positionMatch) {
    const index = Number(positionMatch[1]);
    if (Number.isFinite(index) && index >= 0) {
      let line = 1;
      let column = 1;
      for (let i = 0; i < sql.length && i < index; i += 1) {
        if (sql[i] === '\n') {
          line += 1;
          column = 1;
        } else {
          column += 1;
        }
      }
      return { line, column };
    }
  }

  const tokenMatch = rawMessage.match(/near\s+["']([^"']+)["']/i);
  if (tokenMatch) {
    const token = tokenMatch[1].trim();
    const tokenIndex = sql.toLowerCase().indexOf(token.toLowerCase());
    if (tokenIndex >= 0) {
      let line = 1;
      let column = 1;
      for (let i = 0; i < tokenIndex; i += 1) {
        if (sql[i] === '\n') {
          line += 1;
          column = 1;
        } else {
          column += 1;
        }
      }
      return { line, column };
    }
  }

  return undefined;
}

function classifyError(rawMessage: string): Classification {
  const msg = normalizeWhitespace(rawMessage);
  const lower = msg.toLowerCase();

  if (lower.includes('not initialized') || lower.includes('engine not ready')) {
    return {
      code: 'QC_ENGINE_NOT_READY',
      category: 'engine',
      title: 'SQL engine is not ready',
      message: 'The SQL engine is still starting up. Try running the query again in a moment.',
      hint: 'Wait for initialization to complete, then retry.',
      recoverable: true,
    };
  }

  if (lower.includes('no such table') || lower.includes("doesn't exist")) {
    return {
      code: 'QC_TABLE_NOT_FOUND',
      category: 'table-not-found',
      title: 'Table not found',
      message: 'The query references a table that does not exist in the current schema.',
      hint: 'Check table names or run SHOW TABLES first.',
      recoverable: true,
    };
  }

  if (lower.includes('no such column') || lower.includes('unknown column')) {
    return {
      code: 'QC_COLUMN_NOT_FOUND',
      category: 'column-not-found',
      title: 'Column not found',
      message: 'A referenced column could not be resolved.',
      hint: 'Verify column names and aliases in SELECT, WHERE, JOIN, and ORDER BY.',
      recoverable: true,
    };
  }

  if (
    lower.includes('syntax error') ||
    lower.includes('parse error') ||
    lower.includes('incomplete input')
  ) {
    return {
      code: 'QC_SYNTAX_ERROR',
      category: 'syntax',
      title: 'SQL syntax error',
      message: 'The query has invalid SQL syntax for the current parser.',
      hint: 'Check commas, quotes, parentheses, and clause order.',
      recoverable: true,
    };
  }

  if (
    lower.includes('constraint failed') ||
    lower.includes('foreign key') ||
    lower.includes('unique constraint') ||
    lower.includes('not null')
  ) {
    return {
      code: 'QC_CONSTRAINT_ERROR',
      category: 'constraint',
      title: 'Constraint violation',
      message: 'The operation violates schema constraints.',
      hint: 'Review primary key, unique, foreign key, and not-null constraints.',
      recoverable: true,
    };
  }

  if (
    lower.includes('datatype mismatch') ||
    lower.includes('type mismatch') ||
    lower.includes('cannot cast')
  ) {
    return {
      code: 'QC_TYPE_ERROR',
      category: 'type',
      title: 'Type mismatch',
      message: 'One or more values are incompatible with the target column type.',
      hint: 'Cast values explicitly or adjust column types.',
      recoverable: true,
    };
  }

  if (
    lower.includes('cannot start a transaction') ||
    lower.includes('no transaction is active') ||
    lower.includes('locked')
  ) {
    return {
      code: 'QC_TRANSACTION_ERROR',
      category: 'transaction',
      title: 'Transaction error',
      message: 'The transaction command is invalid for the current transaction state.',
      hint: 'Check BEGIN, COMMIT, and ROLLBACK order.',
      recoverable: true,
    };
  }

  if (lower.includes('not supported') || lower.includes('unsupported')) {
    return {
      code: 'QC_UNSUPPORTED_FEATURE',
      category: 'unsupported',
      title: 'Feature not supported',
      message: 'This SQL construct is not supported in the current execution engine.',
      hint: 'Try an equivalent SQLite-compatible query.',
      recoverable: true,
    };
  }

  return {
    code: 'QC_SQL_EXECUTION_ERROR',
    category: 'unknown',
    title: 'SQL execution failed',
    message: 'The query could not be executed.',
    hint: 'Review query syntax and referenced schema objects.',
    recoverable: true,
  };
}

export class SqlErrorEngine {
  fromUnknownError(error: unknown, options: BuildOptions): QueryResult {
    const rawMessage = error instanceof Error ? error.message : String(error);
    return this.fromMessage(rawMessage, options);
  }

  fromMessage(message: string, options: BuildOptions): QueryResult {
    const details = this.buildDetails(message, options);
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: performance.now() - options.startTime,
      error: details.message,
      errorDetails: details,
    };
  }

  enrichResultWithError(
    result: QueryResult,
    options: Omit<BuildOptions, 'startTime'>,
  ): QueryResult {
    if (!result.error) return result;
    const details = this.buildDetails(result.error, {
      ...options,
      startTime: performance.now() - result.executionTimeMs,
    });

    return {
      ...result,
      error: details.message,
      errorDetails: details,
    };
  }

  private buildDetails(rawMessage: string, options: BuildOptions): SqlErrorDetails {
    const classification = classifyError(rawMessage);
    const location = parsePosition(rawMessage, options.translatedSql ?? options.sql);

    return {
      code: classification.code,
      category: classification.category,
      severity: 'error',
      title: classification.title,
      message: classification.message,
      hint: classification.hint,
      rawMessage: rawMessage.trim(),
      location,
      recoverable: classification.recoverable,
    };
  }
}

export const sqlErrorEngine = new SqlErrorEngine();
