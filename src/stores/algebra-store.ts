import { create } from 'zustand';
import type { AlgebraNode } from '@/types/algebra';
import type { StepResult } from '@/lib/engine/algebra-evaluator';

interface AlgebraStore {
  expression: string;
  parsedTree: AlgebraNode | null;
  steps: StepResult[];
  activeStepIndex: number;
  error: string | null;
  sqlEquivalent: string;
  setExpression: (expr: string) => void;
  setParsedTree: (tree: AlgebraNode | null) => void;
  setSteps: (steps: StepResult[]) => void;
  setActiveStepIndex: (index: number) => void;
  setError: (error: string | null) => void;
  setSqlEquivalent: (sql: string) => void;
  clear: () => void;
}

export const useAlgebraStore = create<AlgebraStore>((set) => ({
  expression: '',
  parsedTree: null,
  steps: [],
  activeStepIndex: -1,
  error: null,
  sqlEquivalent: '',
  setExpression: (expression) => set({ expression }),
  setParsedTree: (parsedTree) => set({ parsedTree }),
  setSteps: (steps) => set({ steps }),
  setActiveStepIndex: (activeStepIndex) => set({ activeStepIndex }),
  setError: (error) => set({ error }),
  setSqlEquivalent: (sqlEquivalent) => set({ sqlEquivalent }),
  clear: () =>
    set({
      expression: '',
      parsedTree: null,
      steps: [],
      activeStepIndex: -1,
      error: null,
      sqlEquivalent: '',
    }),
}));
