'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SqlExecutor } from '@/lib/engine/sql-executor';
import type { QueryResult, TableSchema } from '@/types/database';
import { useLoadingStore } from '@/stores/loading-store';

export function useSqlEngine() {
  const executorRef = useRef<SqlExecutor | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [tables, setTables] = useState<TableSchema[]>([]);
  const { start: startLoading, stop: stopLoading } = useLoadingStore();

  useEffect(() => {
    startLoading('Initializing SQL engine…');
    const executor = new SqlExecutor();
    executorRef.current = executor;
    executor.init().then(() => {
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
    setTables(executorRef.current.getTables());
    return result;
  }, []);

  const loadSQL = useCallback((sql: string): QueryResult => {
    if (!executorRef.current?.isReady()) {
      return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0, error: 'Engine not ready' };
    }
    const result = executorRef.current.loadSQL(sql);
    setTables(executorRef.current.getTables());
    return result;
  }, []);

  const reset = useCallback(() => {
    if (executorRef.current) {
      executorRef.current.reset();
      setIsReady(false);
      setTables([]);
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
