import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QueryResult, StatementQueryResult } from '@/types/database';
import type { SqlErrorDetails } from '@/types/sql-error';

interface PersistedStatementResult extends Omit<StatementQueryResult, 'rows'> {
  rows: Record<string, unknown>[];
}

export interface HistoryEntry {
  query: string;
  database: string;
  timestamp: number;
  success: boolean;
  result: {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
    error?: string;
    errorDetails?: SqlErrorDetails;
    statementResults?: PersistedStatementResult[];
  };
}

interface SandboxStore {
  query: string;
  results: QueryResult | null;
  queryHistory: HistoryEntry[];
  pendingDatabase: string | null;
  activeTab: 'results' | 'schema' | 'history';
  setQuery: (query: string) => void;
  setResults: (results: QueryResult | null) => void;
  setPendingDatabase: (database: string | null) => void;
  addToHistory: (query: string, success: boolean, result: QueryResult, database: string) => void;
  clearHistory: () => void;
  setActiveTab: (tab: 'results' | 'schema' | 'history') => void;
}

export const useSandboxStore = create<SandboxStore>()(
  persist(
    (set) => ({
      query: '-- Write your SQL here\nSELECT 1 + 1 AS result;',
      results: null,
      queryHistory: [],
      pendingDatabase: null,
      activeTab: 'results',
      setQuery: (query) => set({ query }),
      setResults: (results) => set({ results }),
      setPendingDatabase: (pendingDatabase) => set({ pendingDatabase }),
      addToHistory: (query, success, result, database) =>
        set((state) => ({
          queryHistory: [
            {
              query,
              database,
              timestamp: Date.now(),
              success,
              result: {
                columns: result.columns,
                rows: result.rows.slice(0, 50),
                rowCount: result.rowCount,
                executionTimeMs: result.executionTimeMs,
                error: result.error,
                errorDetails: result.errorDetails,
                statementResults: result.statementResults?.map((entry) => ({
                  ...entry,
                  rows: entry.rows.slice(0, 50),
                })),
              },
            },
            ...state.queryHistory,
          ].slice(0, 100),
        })),
      clearHistory: () => set({ queryHistory: [] }),
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    {
      name: 'querycraft-sandbox',
      partialize: (state) => ({
        query: state.query,
        queryHistory: state.queryHistory,
        pendingDatabase: state.pendingDatabase,
      }),
    },
  ),
);
