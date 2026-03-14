import type { SqlErrorDetails } from '@/types/sql-error';

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: { table: string; column: string };
  defaultValue?: string;
}

export interface TableSchema {
  name: string;
  columns: Column[];
}

export type Row = Record<string, unknown>;

export interface QueryResult {
  columns: string[];
  rows: Row[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
  errorDetails?: SqlErrorDetails;
}
