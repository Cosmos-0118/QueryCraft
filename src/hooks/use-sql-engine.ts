'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SqlExecutor } from '@/lib/engine/sql-executor';
import { splitSqlStatements } from '@/lib/engine/sql-executor/statement-splitter';
import { sqlErrorEngine } from '@/lib/engine/sql-error-engine';
import type { QueryResult, TableSchema } from '@/types/database';
import { useLoadingStore } from '@/stores/loading-store';
import { getUserKey, STORAGE_BASE_KEYS } from '@/lib/utils/user-storage';
import { fetchSeedDatasets, type SeedDataset } from '@/lib/seed-datasets';

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

function isDatabaseSwitchSql(sql: string): boolean {
  return /^\s*USE\s+/i.test(sql);
}

function isDatabaseDDL(sql: string): boolean {
  return /\b(CREATE|DROP)\s+(DATABASE|SCHEMA)\b/i.test(sql);
}

function shouldPersistSql(sql: string): boolean {
  return isMutatingSql(sql) || isDatabaseSwitchSql(sql) || isDatabaseDDL(sql);
}

function jsonToSQL(data: Record<string, Record<string, unknown>[]>): string {
  const statements: string[] = [];
  for (const [table, rows] of Object.entries(data)) {
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    const colDefs = cols.map((c) => {
      const sample = rows[0][c];
      const t = typeof sample === 'number' ? (Number.isInteger(sample) ? 'INTEGER' : 'REAL') : 'TEXT';
      return `"${c}" ${t}${c === 'id' ? ' PRIMARY KEY' : ''}`;
    });
    statements.push(`CREATE TABLE IF NOT EXISTS "${table}" (${colDefs.join(', ')});`);
    for (const row of rows) {
      const vals = cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      statements.push(`INSERT INTO "${table}" VALUES (${vals.join(', ')});`);
    }
  }
  return statements.join('\n');
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
    const key = getUserKey(STORAGE_BASE_KEYS.engineState);
    const raw = localStorage.getItem(key);
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
    const key = getUserKey(STORAGE_BASE_KEYS.engineState);
    localStorage.setItem(
      key,
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
    const key = getUserKey(STORAGE_BASE_KEYS.engineState);
    localStorage.removeItem(key);
  } catch {
    // localStorage unavailable
  }
}

function loadPersistedActiveDatabase(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getUserKey(STORAGE_BASE_KEYS.activeDatabase);
    const value = localStorage.getItem(key);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

function savePersistedActiveDatabase(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getUserKey(STORAGE_BASE_KEYS.activeDatabase);
    localStorage.setItem(key, name);
  } catch {
    // localStorage unavailable
  }
}

function clearPersistedActiveDatabase(): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getUserKey(STORAGE_BASE_KEYS.activeDatabase);
    localStorage.removeItem(key);
  } catch {
    // localStorage unavailable
  }
}

function loadPersistedActiveUser(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getUserKey(STORAGE_BASE_KEYS.activeUser);
    const value = localStorage.getItem(key);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

function savePersistedActiveUser(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getUserKey(STORAGE_BASE_KEYS.activeUser);
    localStorage.setItem(key, name);
  } catch {
    // localStorage unavailable
  }
}

function clearPersistedActiveUser(): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getUserKey(STORAGE_BASE_KEYS.activeUser);
    localStorage.removeItem(key);
  } catch {
    // localStorage unavailable
  }
}

/**
 * During replay, ensure all referenced databases exist before executing statements.
 * This fixes the issue where CREATE DATABASE was not persisted and tables would
 * land in `main` or disappear.
 */
function replayPersistedStatements(
  executor: SqlExecutor,
  statements: PersistedStatementRecord[],
): void {
  // Phase 1: Collect all unique databases and create them
  const referencedDatabases = new Set<string>();
  for (const record of statements) {
    if (record.database && record.database !== 'main') {
      referencedDatabases.add(record.database);
    }
    // Also parse CREATE DATABASE from SQL itself
    const createDbMatch = record.sql.match(
      /CREATE\s+(?:DATABASE|SCHEMA)(?:\s+IF\s+NOT\s+EXISTS)?\s+[`"']?(\w+)[`"']?/i,
    );
    if (createDbMatch?.[1] && createDbMatch[1].toLowerCase() !== 'main') {
      referencedDatabases.add(createDbMatch[1]);
    }
  }

  for (const dbName of referencedDatabases) {
    executor.execute(`CREATE DATABASE IF NOT EXISTS "${dbName}"`);
  }

  // Phase 2: Replay each statement in its correct database context
  for (const record of statements) {
    const switchResult = executor.useDatabase(record.database);
    if (switchResult.error) {
      // If the database doesn't exist, try creating it
      executor.execute(`CREATE DATABASE IF NOT EXISTS "${record.database}"`);
      const retrySwitch = executor.useDatabase(record.database);
      if (retrySwitch.error) {
        executor.useDatabase('main');
      }
    }

    const stmts = splitSqlStatements(record.sql);
    for (const statement of stmts) {
      executor.loadSQL(statement);
    }
  }

  // Return to main after replay
  executor.useDatabase('main');
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
  const [seedDatasets, setSeedDatasets] = useState<SeedDataset[]>([]);
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
      .then(async () => {
        let loadedDatasets: SeedDataset[] = [];
        if (!isolated) {
          try {
            loadedDatasets = await fetchSeedDatasets();
            // Abort if the component unmounted or a new executor was created (Strict Mode)
            if (executorRef.current !== executor) return;
            
            setSeedDatasets(loadedDatasets);
            for (const ds of loadedDatasets) {
              executor.execute(`CREATE DATABASE IF NOT EXISTS "${ds.name}"`);
              executor.useDatabase(ds.name);
              const sql = jsonToSQL(ds.data as Record<string, Record<string, unknown>[]>);
              executor.loadSQL(sql);
            }
          } catch (e) {
            console.error('Failed to load seed datasets:', e);
          }
        }

        // Check again after potential await
        if (executorRef.current !== executor) return;

        executor.useDatabase('main');

        if (!isolated && persistedStatementsRef.current.length > 0) {
          replayPersistedStatements(executor, persistedStatementsRef.current);
        }

        if (!isolated) {
          // Default to the first seed dataset if 'main' isn't preferred
          let preferredDb = 'main';
          
          if (loadedDatasets.length > 0) {
            preferredDb = loadedDatasets[0].name;
          }

          const persistedActiveDb = loadPersistedActiveDatabase();
          if (persistedActiveDb) {
            preferredDb = persistedActiveDb;
          }

          executor.useDatabase(preferredDb);

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
      if (!result.error && shouldPersist && shouldPersistSql(sql)) {
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
      if (!result.error && shouldPersist && shouldPersistSql(sql)) {
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
    seedDatasets,
  };
}
