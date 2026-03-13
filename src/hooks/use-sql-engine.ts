'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SqlExecutor } from '@/lib/engine/sql-executor';
import type { QueryResult, TableSchema } from '@/types/database';
import { useLoadingStore } from '@/stores/loading-store';

const ENGINE_STATE_KEY = 'querycraft-sql-engine-state-v1';
const MAX_PERSISTED_STATEMENTS = 1000;

interface PersistedEngineState {
  statements: string[];
}

function isMutatingSql(sql: string): boolean {
  return /\b(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|MERGE|RENAME)\b/i.test(sql);
}

function loadPersistedStatements(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ENGINE_STATE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedEngineState;
    return Array.isArray(parsed.statements)
      ? parsed.statements.filter((statement): statement is string => typeof statement === 'string')
      : [];
  } catch {
    return [];
  }
}

function savePersistedStatements(statements: string[]): void {
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

export function useSqlEngine() {
  const executorRef = useRef<SqlExecutor | null>(null);
  const persistedStatementsRef = useRef<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [tables, setTables] = useState<TableSchema[]>([]);
  const { start: startLoading, stop: stopLoading } = useLoadingStore();

  useEffect(() => {
    persistedStatementsRef.current = loadPersistedStatements();
    startLoading('Initializing SQL engine…');
    const executor = new SqlExecutor();
    executorRef.current = executor;
    executor.init().then(() => {
      if (persistedStatementsRef.current.length > 0) {
        executor.loadSQL(persistedStatementsRef.current.join('\n'));
      }
      setIsReady(true);
      setTables(executor.getTables());
      stopLoading();
    });
    return () => {
      executor.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const execute = useCallback((sql: string): QueryResult => {
    if (!executorRef.current?.isReady()) {
      return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0, error: 'Engine not ready' };
    }
    const result = executorRef.current.execute(sql);
    if (!result.error && isMutatingSql(sql)) {
      persistedStatementsRef.current = [...persistedStatementsRef.current, sql];
      savePersistedStatements(persistedStatementsRef.current);
    }
    setTables(executorRef.current.getTables());
    return result;
  }, []);

  const loadSQL = useCallback((sql: string): QueryResult => {
    if (!executorRef.current?.isReady()) {
      return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0, error: 'Engine not ready' };
    }
    const result = executorRef.current.loadSQL(sql);
    if (!result.error && isMutatingSql(sql)) {
      persistedStatementsRef.current = [...persistedStatementsRef.current, sql];
      savePersistedStatements(persistedStatementsRef.current);
    }
    setTables(executorRef.current.getTables());
    return result;
  }, []);

  const reset = useCallback(() => {
    if (executorRef.current) {
      executorRef.current.reset();
      setIsReady(false);
      setTables([]);
      persistedStatementsRef.current = [];
      clearPersistedStatements();
      const executor = new SqlExecutor();
      executorRef.current = executor;
      executor.init().then(() => {
        setIsReady(true);
        setTables(executor.getTables());
      });
    }
  }, []);

  const exportCSV = useCallback((result: QueryResult): string => {
    return executorRef.current?.exportCSV(result) ?? '';
  }, []);

  const refreshTables = useCallback(() => {
    if (executorRef.current?.isReady()) {
      setTables(executorRef.current.getTables());
    }
  }, []);

  return { isReady, execute, loadSQL, reset, exportCSV, tables, refreshTables };
}
