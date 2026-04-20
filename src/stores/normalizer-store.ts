import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { NormalForm, FunctionalDependency, Decomposition } from '@/types/normalizer';
import { userScopedStateStorage, STORAGE_BASE_KEYS } from '@/lib/utils/user-storage';

interface NormalizerStore {
  tableName: string;
  columns: string[];
  rows: string[][];
  fds: FunctionalDependency[];
  currentNF: NormalForm | null;
  targetNF: NormalForm;
  selectedForm: NormalForm;
  decomposition: Decomposition | null;
  activeStep: number;

  setTableName: (name: string) => void;
  setColumns: (columns: string[]) => void;
  setRows: (rows: string[][]) => void;
  addFD: (fd: FunctionalDependency) => void;
  removeFD: (index: number) => void;
  setFDs: (fds: FunctionalDependency[]) => void;
  setCurrentNF: (nf: NormalForm | null) => void;
  setTargetNF: (nf: NormalForm) => void;
  setSelectedForm: (nf: NormalForm) => void;
  setDecomposition: (d: Decomposition | null) => void;
  setActiveStep: (step: number) => void;
  clear: () => void;
}

export const useNormalizerStore = create<NormalizerStore>()(
  persist(
    (set) => ({
      tableName: 'R',
      columns: [],
      rows: [],
      fds: [],
      currentNF: null,
      targetNF: 'UNF',
      selectedForm: 'UNF',
      decomposition: null,
      activeStep: 0,

      setTableName: (tableName) => set({ tableName }),
      setColumns: (columns) => set({ columns }),
      setRows: (rows) => set({ rows }),
      addFD: (fd) => set((s) => ({ fds: [...s.fds, fd] })),
      removeFD: (index) => set((s) => ({ fds: s.fds.filter((_, i) => i !== index) })),
      setFDs: (fds) => set({ fds }),
      setCurrentNF: (currentNF) => set({ currentNF }),
      setTargetNF: (targetNF) => set({ targetNF }),
      setSelectedForm: (selectedForm) => set({ selectedForm }),
      setDecomposition: (decomposition) => set({ decomposition }),
      setActiveStep: (activeStep) => set({ activeStep }),
      clear: () =>
        set({
          tableName: 'R',
          columns: [],
          rows: [],
          fds: [],
          currentNF: null,
          targetNF: 'UNF',
          selectedForm: 'UNF',
          decomposition: null,
          activeStep: 0,
        }),
    }),
    {
      name: STORAGE_BASE_KEYS.normalizer,
      storage: createJSONStorage(() => userScopedStateStorage),
      partialize: (state) => ({
        tableName: state.tableName,
        columns: state.columns,
        rows: state.rows,
        fds: state.fds,
        targetNF: state.targetNF,
        selectedForm: state.selectedForm,
      }),
    },
  ),
);
