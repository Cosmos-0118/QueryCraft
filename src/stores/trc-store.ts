import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { userScopedStateStorage, STORAGE_BASE_KEYS } from '@/lib/utils/user-storage';

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
  selectedDatabase: string;
  sqlEquivalent: string;
  error: string | null;
  history: TrcHistoryEntry[];
  setExpression: (value: string) => void;
  setSelectedDatabase: (value: string) => void;
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
      selectedDatabase: 'main',
      sqlEquivalent: '',
      error: null,
      history: [],
      setExpression: (expression) => set({ expression }),
      setSelectedDatabase: (selectedDatabase) => set({ selectedDatabase }),
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
      name: STORAGE_BASE_KEYS.trc,
      storage: createJSONStorage(() => userScopedStateStorage),
      partialize: (state) => ({
        expression: state.expression,
        history: state.history,
        selectedDatabase: state.selectedDatabase,
      }),
    },
  ),
);
