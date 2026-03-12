import { create } from 'zustand';
import type { EREntity, ERAttribute, ERRelationship, ERDiagram, AttributeKind, Cardinality } from '@/types/er-diagram';
import type { TableSchema } from '@/types/database';

interface ERStore {
  entities: EREntity[];
  attributes: ERAttribute[];
  relationships: ERRelationship[];
  generatedTables: TableSchema[];
  selectedId: string | null;

  addEntity: (name: string, pos: { x: number; y: number }, isWeak?: boolean) => string;
  addAttribute: (name: string, kind: AttributeKind, entityId: string, pos: { x: number; y: number }) => string;
  addRelationship: (name: string, cardinality: Cardinality, entities: [string, string], pos: { x: number; y: number }) => string;
  updateEntityPos: (id: string, pos: { x: number; y: number }) => void;
  updateAttributePos: (id: string, pos: { x: number; y: number }) => void;
  updateRelationshipPos: (id: string, pos: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setGeneratedTables: (tables: TableSchema[]) => void;
  getDiagram: () => ERDiagram;
  clear: () => void;
  loadDiagram: (diagram: ERDiagram) => void;
}

let idCounter = 0;
function uid() { return `er_${++idCounter}_${Date.now()}`; }

export const useERStore = create<ERStore>((set, get) => ({
  entities: [],
  attributes: [],
  relationships: [],
  generatedTables: [],
  selectedId: null,

  addEntity: (name, pos, isWeak = false) => {
    const id = uid();
    set((s) => ({ entities: [...s.entities, { id, name, isWeak, position: pos }] }));
    return id;
  },

  addAttribute: (name, kind, entityId, pos) => {
    const id = uid();
    set((s) => ({ attributes: [...s.attributes, { id, name, kind, entityId, position: pos }] }));
    return id;
  },

  addRelationship: (name, cardinality, entities, pos) => {
    const id = uid();
    set((s) => ({ relationships: [...s.relationships, { id, name, cardinality, entities, position: pos }] }));
    return id;
  },

  updateEntityPos: (id, pos) =>
    set((s) => ({ entities: s.entities.map((e) => (e.id === id ? { ...e, position: pos } : e)) })),

  updateAttributePos: (id, pos) =>
    set((s) => ({ attributes: s.attributes.map((a) => (a.id === id ? { ...a, position: pos } : a)) })),

  updateRelationshipPos: (id, pos) =>
    set((s) => ({ relationships: s.relationships.map((r) => (r.id === id ? { ...r, position: pos } : r)) })),

  removeNode: (id) =>
    set((s) => ({
      entities: s.entities.filter((e) => e.id !== id),
      attributes: s.attributes.filter((a) => a.id !== id && a.entityId !== id),
      relationships: s.relationships.filter((r) => r.id !== id && !r.entities.includes(id)),
    })),

  setSelectedId: (selectedId) => set({ selectedId }),
  setGeneratedTables: (generatedTables) => set({ generatedTables }),

  getDiagram: () => {
    const { entities, attributes, relationships } = get();
    return { entities, attributes, relationships };
  },

  clear: () => set({ entities: [], attributes: [], relationships: [], generatedTables: [], selectedId: null }),

  loadDiagram: (diagram) => set({
    entities: diagram.entities,
    attributes: diagram.attributes,
    relationships: diagram.relationships,
    generatedTables: [],
    selectedId: null,
  }),
}));
