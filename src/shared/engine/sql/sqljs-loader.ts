import type { SqlJs } from './types';

let sqlPromise: Promise<SqlJs> | null = null;

export function loadSqlJs(): Promise<SqlJs> {
  if (!sqlPromise) {
    sqlPromise = import('sql.js').then((mod) => {
      const initSqlJs = mod.default;
      return initSqlJs({
        locateFile: () =>
          typeof window === 'undefined'
            ? 'node_modules/sql.js/dist/sql-wasm.wasm'
            : '/sql-wasm.wasm',
      });
    });
  }
  return sqlPromise;
}

export function resetSqlJsLoader(): void {
  sqlPromise = null;
}