import { create } from 'zustand';
import type { QueryResult } from '@/types/database';

interface SandboxStore {
  query: string;
  results: QueryResult | null;
  queryHistory: string[];
  setQuery: (query: string) => void;
  setResults: (results: QueryResult | null) => void;
  addToHistory: (query: string) => void;
  clearHistory: () => void;
}

export const useSandboxStore = create<SandboxStore>((set) => ({
  query: '',
  results: null,
  queryHistory: [],
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  addToHistory: (query) =>
    set((state) => ({ queryHistory: [query, ...state.queryHistory].slice(0, 100) })),
  clearHistory: () => set({ queryHistory: [] }),
}));
