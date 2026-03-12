import { create } from 'zustand';

export type NormalForm = 'UNF' | '1NF' | '2NF' | '3NF' | 'BCNF' | '4NF' | '5NF';

interface FunctionalDependency {
  determinant: string[];
  dependent: string[];
}

interface NormalizerStore {
  columns: string[];
  fds: FunctionalDependency[];
  currentNF: NormalForm | null;
  setColumns: (columns: string[]) => void;
  addFD: (fd: FunctionalDependency) => void;
  removeFD: (index: number) => void;
  setCurrentNF: (nf: NormalForm | null) => void;
  clear: () => void;
}

export const useNormalizerStore = create<NormalizerStore>((set) => ({
  columns: [],
  fds: [],
  currentNF: null,
  setColumns: (columns) => set({ columns }),
  addFD: (fd) => set((s) => ({ fds: [...s.fds, fd] })),
  removeFD: (index) => set((s) => ({ fds: s.fds.filter((_, i) => i !== index) })),
  setCurrentNF: (currentNF) => set({ currentNF }),
  clear: () => set({ columns: [], fds: [], currentNF: null }),
}));
