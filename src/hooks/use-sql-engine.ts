'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SqlExecutor } from '@/lib/engine/sql-executor';
import type { QueryResult, TableSchema } from '@/types/database';

export function useSqlEngine() {
  const executorRef = useRef<SqlExecutor | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [tables, setTables] = useState<TableSchema[]>([]);

  useEffect(() => {
    const executor = new SqlExecutor();
    executorRef.current = executor;
    executor.init().then(() => {
      setIsReady(true);
      setTables(executor.getTables());
    });
    return () => {
      executor.reset();
    };
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
