import type { QueryResult } from '@/types/database';

export type SqlJsDatabase = {
  run: (sql: string) => void;
  exec: (sql: string) => { columns: string[]; values: unknown[][] }[];
  getRowsModified: () => number;
  close: () => void;
};

export type SqlJs = {
  Database: new () => SqlJsDatabase;
};

export interface TranslatedQuery {
  sql: string | null;
  result?: QueryResult;
}

export type SupportedPrivilege =
  | 'ALL PRIVILEGES'
  | 'SELECT'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'CREATE'
  | 'ALTER'
  | 'DROP'
  | 'INDEX'
  | 'REFERENCES'
  | 'EXECUTE';

export interface DbUser {
  username: string;
  host: string;
  password?: string;
}

export interface GrantEntry {
  database: string;
  table: string;
  privileges: Set<SupportedPrivilege>;
  withGrantOption: boolean;
}

export const SUPPORTED_PRIVILEGES: Set<SupportedPrivilege> = new Set([
  'ALL PRIVILEGES',
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'CREATE',
  'ALTER',
  'DROP',
  'INDEX',
  'REFERENCES',
  'EXECUTE',
]);
