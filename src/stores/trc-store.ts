import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TrcHistoryEntry {
  expression: string;
  timestamp: number;
  success: boolean;
  sqlEquivalent: string;
  error?: string;
  result?: {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
  };
}

interface TrcStore {
  expression: string;
  sqlEquivalent: string;
  error: string | null;
  history: TrcHistoryEntry[];
  setExpression: (value: string) => void;
  setSqlEquivalent: (value: string) => void;
  setError: (value: string | null) => void;
  addToHistory: (entry: Omit<TrcHistoryEntry, 'timestamp'>) => void;
  clearHistory: () => void;
  clear: () => void;
}

export const useTrcStore = create<TrcStore>()(
  persist(
    (set) => ({
      expression: '',
      sqlEquivalent: '',
      error: null,
      history: [],
      setExpression: (expression) => set({ expression }),
      setSqlEquivalent: (sqlEquivalent) => set({ sqlEquivalent }),
      setError: (error) => set({ error }),
      addToHistory: (entry) =>
        set((state) => ({
          history: [{ ...entry, timestamp: Date.now() }, ...state.history].slice(0, 200),
        })),
      clearHistory: () => set({ history: [] }),
      clear: () =>
        set({
          expression: '',
          sqlEquivalent: '',
          error: null,
        }),
    }),
    {
      name: 'querycraft-trc',
      partialize: (state) => ({
        expression: state.expression,
        history: state.history,
      }),
    },
  ),
);
