'use client';

import { useState } from 'react';
import { useERStore } from '@/stores/er-store';
import type { AttributeKind, Cardinality } from '@/types/er-diagram';

export function ERToolbar() {
  const store = useERStore();
  const [mode, setMode] = useState<'entity' | 'relationship' | 'attribute' | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [isWeak, setIsWeak] = useState(false);
  const [attrKind, setAttrKind] = useState<AttributeKind>('regular');
  const [attrEntity, setAttrEntity] = useState('');
  const [relEntity1, setRelEntity1] = useState('');
  const [relEntity2, setRelEntity2] = useState('');
  const [cardinality, setCardinality] = useState<Cardinality>('1:N');

  const handleAdd = () => {
    if (!name.trim()) return;
    const randX = 100 + Math.random() * 400;
    const randY = 50 + Math.random() * 300;

    if (mode === 'entity') {
      store.addEntity(name, { x: randX, y: randY }, isWeak);
    } else if (mode === 'attribute' && attrEntity) {
      const entity = store.entities.find((e) => e.id === attrEntity);
      if (entity) {
        store.addAttribute(name, attrKind, attrEntity, {
          x: entity.position.x + 180,
          y: entity.position.y + Math.random() * 80 - 40,
        });
      }
    } else if (mode === 'relationship' && relEntity1 && relEntity2) {
      const e1 = store.entities.find((e) => e.id === relEntity1);
      const e2 = store.entities.find((e) => e.id === relEntity2);
      if (e1 && e2) {
        store.addRelationship(name, cardinality, [relEntity1, relEntity2], {
          x: (e1.position.x + e2.position.x) / 2,
          y: (e1.position.y + e2.position.y) / 2,
        });
      }
    }

    setName('');
    setMode(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
      <button
        onClick={() => setMode(mode === 'entity' ? null : 'entity')}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'entity' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'
        }`}
      >
        + Entity
      </button>
      <button
        onClick={() => {
          setMode(mode === 'attribute' ? null : 'attribute');
          if (store.entities.length > 0) setAttrEntity(store.entities[0].id);
        }}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'attribute' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'
        }`}
      >
        + Attribute
      </button>
      <button
        onClick={() => {
          setMode(mode === 'relationship' ? null : 'relationship');
          if (store.entities.length >= 2) {
            setRelEntity1(store.entities[0].id);
            setRelEntity2(store.entities[1].id);
          }
        }}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'relationship' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'
        }`}
      >
        + Relationship
      </button>

      {store.selectedId && (
        <button
          onClick={() => { store.removeNode(store.selectedId!); store.setSelectedId(null); }}
          className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/10"
        >
          Delete Selected
        </button>
      )}

      <button
        onClick={store.clear}
        className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/10"
      >
        Clear All
      </button>

      {mode && (
        <div className="flex w-full items-end gap-2 border-t border-border pt-3 mt-1">
          <div>
            <label className="block text-xs font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="mt-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
              placeholder={mode === 'entity' ? 'Entity name' : mode === 'attribute' ? 'Attr name' : 'Rel name'}
              autoFocus
            />
          </div>

          {mode === 'entity' && (
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={isWeak} onChange={(e) => setIsWeak(e.target.checked)} />
              Weak Entity
            </label>
          )}

          {mode === 'attribute' && (
            <>
              <div>
                <label className="block text-xs font-medium">Kind</label>
                <select
                  value={attrKind}
                  onChange={(e) => setAttrKind(e.target.value as AttributeKind)}
                  className="mt-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none"
                >
                  <option value="regular">Regular</option>
                  <option value="key">Key</option>
                  <option value="multivalued">Multivalued</option>
                  <option value="derived">Derived</option>
                  <option value="composite">Composite</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium">Entity</label>
                <select
                  value={attrEntity}
                  onChange={(e) => setAttrEntity(e.target.value)}
                  className="mt-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none"
                >
                  {store.entities.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {mode === 'relationship' && (
            <>
              <div>
                <label className="block text-xs font-medium">Entity 1</label>
                <select
                  value={relEntity1}
                  onChange={(e) => setRelEntity1(e.target.value)}
                  className="mt-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none"
                >
                  {store.entities.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium">Cardinality</label>
                <select
                  value={cardinality}
                  onChange={(e) => setCardinality(e.target.value as Cardinality)}
                  className="mt-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none"
                >
                  <option value="1:1">1:1</option>
                  <option value="1:N">1:N</option>
                  <option value="M:N">M:N</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium">Entity 2</label>
                <select
                  value={relEntity2}
                  onChange={(e) => setRelEntity2(e.target.value)}
                  className="mt-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none"
                >
                  {store.entities.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <button
            onClick={handleAdd}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
