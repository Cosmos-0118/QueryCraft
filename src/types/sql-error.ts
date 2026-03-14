export type SqlErrorCategory =
  | 'syntax'
  | 'table-not-found'
  | 'column-not-found'
  | 'constraint'
  | 'type'
  | 'transaction'
  | 'engine'
  | 'unsupported'
  | 'permission'
  | 'unknown';

export type SqlErrorSeverity = 'error' | 'warning';

export interface SqlErrorLocation {
  line: number;
  column: number;
}

export interface SqlErrorDetails {
  code: string;
  category: SqlErrorCategory;
  severity: SqlErrorSeverity;
  title: string;
  message: string;
  hint?: string;
  rawMessage: string;
  location?: SqlErrorLocation;
  recoverable: boolean;
}
