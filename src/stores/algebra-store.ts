import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AlgebraNode } from '@/types/algebra';
import type { StepResult } from '@/lib/engine/algebra-evaluator';
import { userScopedStateStorage, STORAGE_BASE_KEYS } from '@/lib/utils/user-storage';

export interface AlgebraHistoryEntry {
  expression: string;
  timestamp: number;
  success: boolean;
  sqlEquivalent: string;
  stepCount: number;
  error?: string;
  result?: {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
  };
}

interface AlgebraStore {
  expression: string;
  selectedDatabase: string;
  parsedTree: AlgebraNode | null;
  steps: StepResult[];
  activeStepIndex: number;
  error: string | null;
  sqlEquivalent: string;
  history: AlgebraHistoryEntry[];
  setExpression: (expr: string) => void;
  setSelectedDatabase: (database: string) => void;
  setParsedTree: (tree: AlgebraNode | null) => void;
  setSteps: (steps: StepResult[]) => void;
  setActiveStepIndex: (index: number) => void;
  setError: (error: string | null) => void;
  setSqlEquivalent: (sql: string) => void;
  addToHistory: (entry: Omit<AlgebraHistoryEntry, 'timestamp'>) => void;
  clearHistory: () => void;
  clear: () => void;
}

export const useAlgebraStore = create<AlgebraStore>()(
  persist(
    (set) => ({
      expression: '',
      selectedDatabase: 'main',
      parsedTree: null,
      steps: [],
      activeStepIndex: -1,
      error: null,
      sqlEquivalent: '',
      history: [],
      setExpression: (expression) => set({ expression }),
      setSelectedDatabase: (selectedDatabase) =>
        set((state) => (state.selectedDatabase === selectedDatabase ? state : { selectedDatabase })),
      setParsedTree: (parsedTree) => set({ parsedTree }),
      setSteps: (steps) => set({ steps }),
      setActiveStepIndex: (activeStepIndex) => set({ activeStepIndex }),
      setError: (error) => set({ error }),
      setSqlEquivalent: (sqlEquivalent) => set({ sqlEquivalent }),
      addToHistory: (entry) =>
        set((state) => ({
          history: [{ ...entry, timestamp: Date.now() }, ...state.history].slice(0, 200),
        })),
      clearHistory: () => set({ history: [] }),
      clear: () =>
        set({
          expression: '',
          parsedTree: null,
          steps: [],
          activeStepIndex: -1,
          error: null,
          sqlEquivalent: '',
        }),
    }),
    {
      name: STORAGE_BASE_KEYS.algebra,
      storage: createJSONStorage(() => userScopedStateStorage),
      partialize: (state) => ({
        expression: state.expression,
        history: state.history,
        selectedDatabase: state.selectedDatabase,
      }),
    },
  ),
);
