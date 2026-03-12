import { create } from 'zustand';
import type { NormalForm, FunctionalDependency, Decomposition } from '@/types/normalizer';

interface NormalizerStore {
  tableName: string;
  columns: string[];
  fds: FunctionalDependency[];
  currentNF: NormalForm | null;
  targetNF: NormalForm;
  decomposition: Decomposition | null;
  activeStep: number;

  setTableName: (name: string) => void;
  setColumns: (columns: string[]) => void;
  addFD: (fd: FunctionalDependency) => void;
  removeFD: (index: number) => void;
  setCurrentNF: (nf: NormalForm | null) => void;
  setTargetNF: (nf: NormalForm) => void;
  setDecomposition: (d: Decomposition | null) => void;
  setActiveStep: (step: number) => void;
  clear: () => void;
}

export const useNormalizerStore = create<NormalizerStore>((set) => ({
  tableName: 'R',
  columns: [],
  fds: [],
  currentNF: null,
  targetNF: 'BCNF',
  decomposition: null,
  activeStep: 0,

  setTableName: (tableName) => set({ tableName }),
  setColumns: (columns) => set({ columns }),
  addFD: (fd) => set((s) => ({ fds: [...s.fds, fd] })),
  removeFD: (index) => set((s) => ({ fds: s.fds.filter((_, i) => i !== index) })),
  setCurrentNF: (currentNF) => set({ currentNF }),
  setTargetNF: (targetNF) => set({ targetNF }),
  setDecomposition: (decomposition) => set({ decomposition }),
  setActiveStep: (activeStep) => set({ activeStep }),
  clear: () =>
    set({
      tableName: 'R',
      columns: [],
      fds: [],
      currentNF: null,
      decomposition: null,
      activeStep: 0,
    }),
}));
