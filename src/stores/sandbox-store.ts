import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QueryResult } from '@/types/database';
import type { SqlErrorDetails } from '@/types/sql-error';

export interface HistoryEntry {
  query: string;
  timestamp: number;
  success: boolean;
  result: {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
    error?: string;
    errorDetails?: SqlErrorDetails;
  };
}

interface SandboxStore {
  query: string;
  results: QueryResult | null;
  queryHistory: HistoryEntry[];
  activeTab: 'results' | 'schema' | 'history';
  setQuery: (query: string) => void;
  setResults: (results: QueryResult | null) => void;
  addToHistory: (query: string, success: boolean, result: QueryResult) => void;
  clearHistory: () => void;
  setActiveTab: (tab: 'results' | 'schema' | 'history') => void;
}

export const useSandboxStore = create<SandboxStore>()(
  persist(
    (set) => ({
      query: '-- Write your SQL here\nSELECT 1 + 1 AS result;',
      results: null,
      queryHistory: [],
      activeTab: 'results',
      setQuery: (query) => set({ query }),
      setResults: (results) => set({ results }),
      addToHistory: (query, success, result) =>
        set((state) => ({
          queryHistory: [
            {
              query,
              timestamp: Date.now(),
              success,
              result: {
                columns: result.columns,
                rows: result.rows.slice(0, 50),
                rowCount: result.rowCount,
                executionTimeMs: result.executionTimeMs,
                error: result.error,
                errorDetails: result.errorDetails,
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
      partialize: (state) => ({ query: state.query, queryHistory: state.queryHistory }),
    },
  ),
);
