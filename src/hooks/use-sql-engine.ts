'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SqlExecutor } from '@/lib/engine/sql-executor';
import { splitSqlStatements } from '@/lib/engine/sql-executor/statement-splitter';
import { sqlErrorEngine } from '@/lib/engine/sql-error-engine';
import type { QueryResult, TableSchema } from '@/types/database';
import { useLoadingStore } from '@/stores/loading-store';

const ENGINE_STATE_KEY = 'querycraft-sql-engine-state-v1';
const ACTIVE_DATABASE_KEY = 'querycraft-sql-active-database-v1';
const ACTIVE_USER_KEY = 'querycraft-sql-active-user-v1';
const MAX_PERSISTED_STATEMENTS = 1000;

interface PersistedEngineState {
  statements: Array<string | PersistedStatementRecord>;
}

interface PersistedStatementRecord {
  sql: string;
  database: string;
}

function isMutatingSql(sql: string): boolean {
  return /\b(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|MERGE|RENAME|GRANT|REVOKE)\b/i.test(
    sql,
  );
}

function normalizePersistedStatement(entry: unknown): PersistedStatementRecord | null {
  if (typeof entry === 'string') {
    const sql = entry.trim();
    if (!sql) return null;
    return { sql, database: 'main' };
  }

  if (!entry || typeof entry !== 'object') return null;
  const candidate = entry as Partial<PersistedStatementRecord>;
  const sql = typeof candidate.sql === 'string' ? candidate.sql.trim() : '';
  const database = typeof candidate.database === 'string' ? candidate.database.trim() : '';
  if (!sql) return null;
  return {
    sql,
    database: database || 'main',
  };
}

function loadPersistedStatements(): PersistedStatementRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ENGINE_STATE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedEngineState;
    if (!Array.isArray(parsed.statements)) return [];
    return parsed.statements
      .map(normalizePersistedStatement)
      .filter((statement): statement is PersistedStatementRecord => statement !== null);
  } catch {
    return [];
  }
}

function savePersistedStatements(statements: PersistedStatementRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      ENGINE_STATE_KEY,
      JSON.stringify({
        statements: statements.slice(-MAX_PERSISTED_STATEMENTS),
      } satisfies PersistedEngineState),
    );
  } catch {
    // localStorage unavailable
  }
}

function clearPersistedStatements(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ENGINE_STATE_KEY);
  } catch {
    // localStorage unavailable
  }
}

function loadPersistedActiveDatabase(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(ACTIVE_DATABASE_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

function savePersistedActiveDatabase(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_DATABASE_KEY, name);
  } catch {
    // localStorage unavailable
  }
}

function clearPersistedActiveDatabase(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACTIVE_DATABASE_KEY);
  } catch {
    // localStorage unavailable
  }
}

function loadPersistedActiveUser(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(ACTIVE_USER_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

function savePersistedActiveUser(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_USER_KEY, name);
  } catch {
    // localStorage unavailable
  }
}

function clearPersistedActiveUser(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACTIVE_USER_KEY);
  } catch {
    // localStorage unavailable
  }
}

export function useSqlEngine(options?: { isolated?: boolean }) {
  const isolated = options?.isolated ?? false;
  const executorRef = useRef<SqlExecutor | null>(null);
  const persistedStatementsRef = useRef<PersistedStatementRecord[]>([]);
  const activeDatabaseRef = useRef('main');
  const [isReady, setIsReady] = useState(false);
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [activeDatabase, setActiveDatabase] = useState('main');
  const [users, setUsers] = useState<string[]>([]);
  const [activeUser, setActiveUser] = useState('admin@localhost');
  const [engineUnavailable, setEngineUnavailable] = useState(false);
  const { start: startLoading, stop: stopLoading } = useLoadingStore();

  const syncEngineState = useCallback(
    (options?: { persistSelection?: boolean }) => {
      if (!executorRef.current?.isReady()) return;
      const nextTables = executorRef.current.getTables();
      const nextDatabases = executorRef.current.getDatabases();
      const nextActiveDb = executorRef.current.getActiveDatabase();
      const nextUsers = executorRef.current.getUsers();
      const nextActiveUser = executorRef.current.getCurrentUserDisplay();

      activeDatabaseRef.current = nextActiveDb;
      setTables(nextTables);
      setDatabases(nextDatabases);
      setActiveDatabase(nextActiveDb);
      setUsers(nextUsers);
      setActiveUser(nextActiveUser);
      if (!isolated && (options?.persistSelection ?? true)) {
        savePersistedActiveDatabase(nextActiveDb);
        savePersistedActiveUser(nextActiveUser);
      }
    },
    [isolated],
  );

  useEffect(() => {
    if (!isolated) {
      persistedStatementsRef.current = loadPersistedStatements();
    }
    startLoading('Initializing SQL engine…');
    const executor = new SqlExecutor();
    executorRef.current = executor;

    executor
      .init()
      .then(() => {
        if (!isolated && persistedStatementsRef.current.length > 0) {
          for (const persisted of persistedStatementsRef.current) {
            const statements = splitSqlStatements(persisted.sql);
            for (const statement of statements) {
              const switched = executor.useDatabase(persisted.database);
              if (switched.error) {
                executor.useDatabase('main');
              }
              executor.loadSQL(statement);
            }
          }
        }

        if (!isolated) {
          const persistedActiveDb = loadPersistedActiveDatabase();
          if (persistedActiveDb) {
            executor.useDatabase(persistedActiveDb);
          }

          const persistedActiveUser = loadPersistedActiveUser();
          if (persistedActiveUser) {
            executor.useUser(persistedActiveUser);
          }
        }

        setEngineUnavailable(false);
        setIsReady(true);
        syncEngineState();
      })
      .catch(() => {
        setEngineUnavailable(true);
        setIsReady(false);
        setTables([]);
        setDatabases([]);
        setActiveDatabase('main');
        setUsers([]);
        setActiveUser('admin@localhost');
        activeDatabaseRef.current = 'main';
      })
      .finally(() => {
        stopLoading();
      });

    return () => {
      executor.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncEngineState]);

  useEffect(() => {
    if (isolated || typeof window === 'undefined') return;

    const persistCurrentContext = () => {
      savePersistedActiveDatabase(activeDatabaseRef.current);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistCurrentContext();
      }
    };

    window.addEventListener('beforeunload', persistCurrentContext);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', persistCurrentContext);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isolated]);

  const execute = useCallback(
    (sql: string, options?: { persist?: boolean; persistSelection?: boolean }): QueryResult => {
      const start = performance.now();

      if (engineUnavailable) {
        return sqlErrorEngine.fromMessage('Engine failed to initialize.', {
          sql,
          startTime: start,
        });
      }

      if (!executorRef.current?.isReady()) {
        return sqlErrorEngine.fromMessage('Engine not ready', { sql, startTime: start });
      }

      // Keep executor context aligned with selected database before running statements.
      // This prevents accidental writes to `main` when UI state and engine state drift.
      const pinned = executorRef.current.useDatabase(activeDatabaseRef.current);
      if (pinned.error) {
        return pinned;
      }

      const result = executorRef.current.execute(sql);
      const shouldPersist = !isolated && (options?.persist ?? true);
      if (!result.error && shouldPersist && isMutatingSql(sql)) {
        persistedStatementsRef.current = [
          ...persistedStatementsRef.current,
          {
            sql,
            database: activeDatabaseRef.current,
          },
        ];
        savePersistedStatements(persistedStatementsRef.current);
      }
      syncEngineState({ persistSelection: options?.persistSelection });
      return result;
    },
    [engineUnavailable, isolated, syncEngineState],
  );

  const loadSQL = useCallback(
    (sql: string, options?: { persist?: boolean; persistSelection?: boolean }): QueryResult => {
      const start = performance.now();

      if (engineUnavailable) {
        return sqlErrorEngine.fromMessage('Engine failed to initialize.', {
          sql,
          startTime: start,
        });
      }

      if (!executorRef.current?.isReady()) {
        return sqlErrorEngine.fromMessage('Engine not ready', { sql, startTime: start });
      }

      const pinned = executorRef.current.useDatabase(activeDatabaseRef.current);
      if (pinned.error) {
        return pinned;
      }

      const result = executorRef.current.loadSQL(sql);
      const shouldPersist = !isolated && (options?.persist ?? true);
      if (!result.error && shouldPersist && isMutatingSql(sql)) {
        persistedStatementsRef.current = [
          ...persistedStatementsRef.current,
          {
            sql,
            database: activeDatabaseRef.current,
          },
        ];
        savePersistedStatements(persistedStatementsRef.current);
      }
      syncEngineState({ persistSelection: options?.persistSelection });
      return result;
    },
    [engineUnavailable, isolated, syncEngineState],
  );

  const switchDatabase = useCallback(
    (name: string, options?: { persistSelection?: boolean }): QueryResult => {
      const start = performance.now();

      if (engineUnavailable) {
        return sqlErrorEngine.fromMessage('Engine failed to initialize.', {
          sql: `USE "${name}"`,
          startTime: start,
        });
      }

      if (!executorRef.current?.isReady()) {
        return sqlErrorEngine.fromMessage('Engine not ready', {
          sql: `USE "${name}"`,
          startTime: start,
        });
      }

      const result = executorRef.current.useDatabase(name);
      if (!result.error) {
        activeDatabaseRef.current = name;
        if (!isolated && (options?.persistSelection ?? true)) {
          savePersistedActiveDatabase(name);
        }
        syncEngineState({ persistSelection: options?.persistSelection });
      }
      return result;
    },
    [engineUnavailable, isolated, syncEngineState],
  );

  const getCurrentDatabase = useCallback((): string => {
    return activeDatabaseRef.current;
  }, []);

  const switchUser = useCallback(
    (name: string): QueryResult => {
      const start = performance.now();

      if (engineUnavailable) {
        return sqlErrorEngine.fromMessage('Engine failed to initialize.', {
          sql: `SET USER ${name}`,
          startTime: start,
        });
      }

      if (!executorRef.current?.isReady()) {
        return sqlErrorEngine.fromMessage('Engine not ready', {
          sql: `SET USER ${name}`,
          startTime: start,
        });
      }

      const result = executorRef.current.useUser(name);
      if (!result.error) {
        syncEngineState();
      }
      return result;
    },
    [engineUnavailable, syncEngineState],
  );

  const reset = useCallback(() => {
    if (executorRef.current) {
      executorRef.current.reset();
      setIsReady(false);
      setTables([]);
      setDatabases([]);
      setActiveDatabase('main');
      setUsers([]);
      setActiveUser('admin@localhost');
      activeDatabaseRef.current = 'main';
      persistedStatementsRef.current = [];
      if (!isolated) {
        clearPersistedStatements();
        clearPersistedActiveDatabase();
        clearPersistedActiveUser();
      }
      const executor = new SqlExecutor();
      executorRef.current = executor;
      executor
        .init()
        .then(() => {
          setEngineUnavailable(false);
          setIsReady(true);
          syncEngineState();
        })
        .catch(() => {
          setEngineUnavailable(true);
          setIsReady(false);
          setTables([]);
          setDatabases([]);
          setActiveDatabase('main');
          setUsers([]);
          setActiveUser('admin@localhost');
          activeDatabaseRef.current = 'main';
        });
    }
  }, [isolated, syncEngineState]);

  const exportCSV = useCallback((result: QueryResult): string => {
    return executorRef.current?.exportCSV(result) ?? '';
  }, []);

  const refreshTables = useCallback(() => {
    syncEngineState();
  }, [syncEngineState]);

  return {
    isReady,
    execute,
    loadSQL,
    reset,
    exportCSV,
    tables,
    refreshTables,
    databases,
    activeDatabase,
    getCurrentDatabase,
    switchDatabase,
    users,
    activeUser,
    switchUser,
  };
}
