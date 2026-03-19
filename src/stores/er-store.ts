import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  EREntity,
  ERAttribute,
  ERRelationship,
  ERDiagram,
  AttributeKind,
  Cardinality,
} from '@/types/er-diagram';
import type { TableSchema } from '@/types/database';
import { userScopedStateStorage, STORAGE_BASE_KEYS } from '@/lib/utils/user-storage';

interface Snapshot {
  entities: EREntity[];
  attributes: ERAttribute[];
  relationships: ERRelationship[];
}

interface ERStore {
  entities: EREntity[];
  attributes: ERAttribute[];
  relationships: ERRelationship[];
  generatedTables: TableSchema[];
  selectedId: string | null;

  // History
  past: Snapshot[];
  future: Snapshot[];
  canUndo: boolean;
  canRedo: boolean;

  addEntity: (name: string, pos: { x: number; y: number }, isWeak?: boolean) => string;
  addAttribute: (
    name: string,
    kind: AttributeKind,
    entityId: string,
    pos: { x: number; y: number },
  ) => string;
  addRelationship: (
    name: string,
    cardinality: Cardinality,
    entities: [string, string],
    pos: { x: number; y: number },
  ) => string;
  updateEntityPos: (id: string, pos: { x: number; y: number }) => void;
  updateAttributePos: (id: string, pos: { x: number; y: number }) => void;
  updateRelationshipPos: (id: string, pos: { x: number; y: number }) => void;
  updateEntity: (id: string, updates: Partial<Pick<EREntity, 'name' | 'isWeak'>>) => void;
  updateAttribute: (
    id: string,
    updates: Partial<Pick<ERAttribute, 'name' | 'kind' | 'entityId'>>,
  ) => void;
  updateRelationship: (
    id: string,
    updates: Partial<Pick<ERRelationship, 'name' | 'cardinality'>>,
  ) => void;
  removeNode: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setGeneratedTables: (tables: TableSchema[]) => void;
  getDiagram: () => ERDiagram;
  clear: () => void;
  loadDiagram: (diagram: ERDiagram) => void;
  undo: () => void;
  redo: () => void;
}

let idCounter = 0;
function uid() {
  return `er_${++idCounter}_${Date.now()}`;
}

function snap(s: {
  entities: EREntity[];
  attributes: ERAttribute[];
  relationships: ERRelationship[];
}): Snapshot {
  return {
    entities: s.entities.map((e) => ({ ...e, position: { ...e.position } })),
    attributes: s.attributes.map((a) => ({ ...a, position: { ...a.position } })),
    relationships: s.relationships.map((r) => ({
      ...r,
      entities: [...r.entities] as [string, string],
      position: { ...r.position },
    })),
  };
}

const MAX_HISTORY = 50;

export const useERStore = create<ERStore>()(
  persist(
    (set, get) => ({
      entities: [],
      attributes: [],
      relationships: [],
      generatedTables: [],
      selectedId: null,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,

      addEntity: (name, pos, isWeak = false) => {
        const id = uid();
        set((s) => {
          const snapshot = snap(s);
          return {
            entities: [...s.entities, { id, name, isWeak, position: pos }],
            past: [...s.past.slice(-MAX_HISTORY + 1), snapshot],
            future: [],
            canUndo: true,
            canRedo: false,
          };
        });
        return id;
      },

      addAttribute: (name, kind, entityId, pos) => {
        const id = uid();
        set((s) => {
          const snapshot = snap(s);
          return {
            attributes: [...s.attributes, { id, name, kind, entityId, position: pos }],
            past: [...s.past.slice(-MAX_HISTORY + 1), snapshot],
            future: [],
            canUndo: true,
            canRedo: false,
          };
        });
        return id;
      },

      addRelationship: (name, cardinality, entities, pos) => {
        const id = uid();
        set((s) => {
          const snapshot = snap(s);
          return {
            relationships: [...s.relationships, { id, name, cardinality, entities, position: pos }],
            past: [...s.past.slice(-MAX_HISTORY + 1), snapshot],
            future: [],
            canUndo: true,
            canRedo: false,
          };
        });
        return id;
      },

      // Position updates don't push to history (too frequent during drag)
      updateEntityPos: (id, pos) =>
        set((s) => ({
          entities: s.entities.map((e) => (e.id === id ? { ...e, position: pos } : e)),
        })),

      updateAttributePos: (id, pos) =>
        set((s) => ({
          attributes: s.attributes.map((a) => (a.id === id ? { ...a, position: pos } : a)),
        })),

      updateRelationshipPos: (id, pos) =>
        set((s) => ({
          relationships: s.relationships.map((r) => (r.id === id ? { ...r, position: pos } : r)),
        })),

      updateEntity: (id, updates) =>
        set((s) => {
          const snapshot = snap(s);
          return {
            entities: s.entities.map((e) => (e.id === id ? { ...e, ...updates } : e)),
            past: [...s.past.slice(-MAX_HISTORY + 1), snapshot],
            future: [],
            canUndo: true,
            canRedo: false,
          };
        }),

      updateAttribute: (id, updates) =>
        set((s) => {
          const snapshot = snap(s);
          return {
            attributes: s.attributes.map((a) => (a.id === id ? { ...a, ...updates } : a)),
            past: [...s.past.slice(-MAX_HISTORY + 1), snapshot],
            future: [],
            canUndo: true,
            canRedo: false,
          };
        }),

      updateRelationship: (id, updates) =>
        set((s) => {
          const snapshot = snap(s);
          return {
            relationships: s.relationships.map((r) => (r.id === id ? { ...r, ...updates } : r)),
            past: [...s.past.slice(-MAX_HISTORY + 1), snapshot],
            future: [],
            canUndo: true,
            canRedo: false,
          };
        }),

      removeNode: (id) =>
        set((s) => {
          const snapshot = snap(s);
          return {
            entities: s.entities.filter((e) => e.id !== id),
            attributes: s.attributes.filter((a) => a.id !== id && a.entityId !== id),
            relationships: s.relationships.filter((r) => r.id !== id && !r.entities.includes(id)),
            past: [...s.past.slice(-MAX_HISTORY + 1), snapshot],
            future: [],
            canUndo: true,
            canRedo: false,
            selectedId: s.selectedId === id ? null : s.selectedId,
          };
        }),

      setSelectedId: (selectedId) => set({ selectedId }),
      setGeneratedTables: (generatedTables) => set({ generatedTables }),

      getDiagram: () => {
        const { entities, attributes, relationships } = get();
        return { entities, attributes, relationships };
      },

      clear: () =>
        set((s) => {
          const snapshot = snap(s);
          const past =
            s.entities.length || s.attributes.length || s.relationships.length
              ? [...s.past.slice(-MAX_HISTORY + 1), snapshot]
              : s.past;
          return {
            entities: [],
            attributes: [],
            relationships: [],
            generatedTables: [],
            selectedId: null,
            past,
            future: [],
            canUndo: past.length > 0,
            canRedo: false,
          };
        }),

      loadDiagram: (diagram) =>
        set((s) => {
          const snapshot = snap(s);
          return {
            entities: diagram.entities,
            attributes: diagram.attributes,
            relationships: diagram.relationships,
            generatedTables: [],
            selectedId: null,
            past: [...s.past.slice(-MAX_HISTORY + 1), snapshot],
            future: [],
            canUndo: true,
            canRedo: false,
          };
        }),

      undo: () =>
        set((s) => {
          if (s.past.length === 0) return s;
          const previous = s.past[s.past.length - 1];
          const currentSnap = snap(s);
          return {
            ...previous,
            past: s.past.slice(0, -1),
            future: [currentSnap, ...s.future],
            canUndo: s.past.length > 1,
            canRedo: true,
            selectedId: null,
          };
        }),

      redo: () =>
        set((s) => {
          if (s.future.length === 0) return s;
          const next = s.future[0];
          const currentSnap = snap(s);
          return {
            ...next,
            past: [...s.past, currentSnap],
            future: s.future.slice(1),
            canUndo: true,
            canRedo: s.future.length > 1,
            selectedId: null,
          };
        }),
    }),
    {
      name: STORAGE_BASE_KEYS.er,
      storage: createJSONStorage(() => userScopedStateStorage),
      version: 1,
      partialize: (state) => ({
        entities: state.entities,
        attributes: state.attributes,
        relationships: state.relationships,
        generatedTables: state.generatedTables,
        past: state.past,
        future: state.future,
        canUndo: state.canUndo,
        canRedo: state.canRedo,
      }),
    },
  ),
);
