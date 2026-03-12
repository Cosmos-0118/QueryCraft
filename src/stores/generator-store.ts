import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GeneratorTableDef,
  GeneratorColumnDef,
  ColumnType,
  SemanticHint,
} from '@/lib/engine/data-generator';
import { detectHint, generateMultiTableSQL } from '@/lib/engine/data-generator';

interface GeneratorStore {
  tables: GeneratorTableDef[];
  generatedSQL: string;

  addTable: (name: string) => void;
  removeTable: (index: number) => void;
  updateTableName: (index: number, name: string) => void;
  updateTableRowCount: (index: number, count: number) => void;
  addColumn: (tableIndex: number) => void;
  removeColumn: (tableIndex: number, colIndex: number) => void;
  updateColumn: (
    tableIndex: number,
    colIndex: number,
    updates: Partial<GeneratorColumnDef>,
  ) => void;
  loadTemplate: (tables: GeneratorTableDef[]) => void;
  generate: () => string;
  clear: () => void;
}

const DEFAULT_TABLE: GeneratorTableDef = {
  name: 'students',
  rowCount: 10,
  columns: [
    { name: 'id', type: 'integer', primaryKey: true, hint: 'id' },
    { name: 'name', type: 'text', primaryKey: false, hint: 'name' },
  ],
};

export const useGeneratorStore = create<GeneratorStore>()(
  persist(
    (set, get) => ({
      tables: [{ ...DEFAULT_TABLE, columns: DEFAULT_TABLE.columns.map((c) => ({ ...c })) }],
      generatedSQL: '',

      addTable: (name: string) =>
        set((s) => ({
          tables: [
            ...s.tables,
            {
              name,
              rowCount: 10,
              columns: [
                {
                  name: 'id',
                  type: 'integer' as ColumnType,
                  primaryKey: true,
                  hint: 'id' as SemanticHint,
                },
                {
                  name: 'name',
                  type: 'text' as ColumnType,
                  primaryKey: false,
                  hint: 'name' as SemanticHint,
                },
              ],
            },
          ],
        })),

      removeTable: (index: number) =>
        set((s) => ({
          tables: s.tables.filter((_, i) => i !== index),
        })),

      updateTableName: (index: number, name: string) =>
        set((s) => ({
          tables: s.tables.map((t, i) => (i === index ? { ...t, name } : t)),
        })),

      updateTableRowCount: (index: number, count: number) =>
        set((s) => ({
          tables: s.tables.map((t, i) =>
            i === index ? { ...t, rowCount: Math.max(1, Math.min(1000, count)) } : t,
          ),
        })),

      addColumn: (tableIndex: number) =>
        set((s) => ({
          tables: s.tables.map((t, i) =>
            i === tableIndex
              ? {
                  ...t,
                  columns: [
                    ...t.columns,
                    {
                      name: `col${t.columns.length + 1}`,
                      type: 'text' as ColumnType,
                      primaryKey: false,
                      hint: 'auto' as SemanticHint,
                    },
                  ],
                }
              : t,
          ),
        })),

      removeColumn: (tableIndex: number, colIndex: number) =>
        set((s) => ({
          tables: s.tables.map((t, i) =>
            i === tableIndex ? { ...t, columns: t.columns.filter((_, ci) => ci !== colIndex) } : t,
          ),
        })),

      updateColumn: (
        tableIndex: number,
        colIndex: number,
        updates: Partial<GeneratorColumnDef>,
      ) => {
        set((s) => ({
          tables: s.tables.map((t, i) => {
            if (i !== tableIndex) return t;
            return {
              ...t,
              columns: t.columns.map((c, ci) => {
                if (ci !== colIndex) return c;
                const merged = { ...c, ...updates };
                // Auto-detect hint when name changes & hint is still auto
                if (updates.name && (c.hint === 'auto' || !updates.hint)) {
                  const detected = detectHint(updates.name);
                  merged.hint = detected.hint;
                  // Also suggest type if user hasn't explicitly set it
                  if (!updates.type) {
                    merged.type = detected.suggestedType;
                  }
                }
                return merged;
              }),
            };
          }),
        }));
      },

      loadTemplate: (tables: GeneratorTableDef[]) =>
        set({
          tables: tables.map((t) => ({
            ...t,
            columns: t.columns.map((c) => ({ ...c })),
          })),
          generatedSQL: '',
        }),

      generate: () => {
        const sql = generateMultiTableSQL(get().tables);
        set({ generatedSQL: sql });
        return sql;
      },

      clear: () =>
        set({
          tables: [{ ...DEFAULT_TABLE, columns: DEFAULT_TABLE.columns.map((c) => ({ ...c })) }],
          generatedSQL: '',
        }),
    }),
    {
      name: 'querycraft-generator',
      partialize: (state) => ({ tables: state.tables }),
    },
  ),
);
