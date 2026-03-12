import { create } from 'zustand';
import type { AlgebraNode } from '@/types/algebra';

interface AlgebraStore {
  expression: string;
  parsedTree: AlgebraNode | null;
  setExpression: (expr: string) => void;
  setParsedTree: (tree: AlgebraNode | null) => void;
  clear: () => void;
}

export const useAlgebraStore = create<AlgebraStore>((set) => ({
  expression: '',
  parsedTree: null,
  setExpression: (expression) => set({ expression }),
  setParsedTree: (parsedTree) => set({ parsedTree }),
  clear: () => set({ expression: '', parsedTree: null }),
}));
