'use client';

import { useState } from 'react';
import { useERStore } from '@/stores/er-store';
import type { AttributeKind, Cardinality } from '@/types/er-diagram';
import { Box, Circle, Diamond, Trash2, X, KeyRound, MousePointer2 } from 'lucide-react';

export function PropertiesPanel() {
  const store = useERStore();
  const { selectedId, entities, attributes, relationships } = store;

  const entity = entities.find((e) => e.id === selectedId);
  const attribute = attributes.find((a) => a.id === selectedId);
  const relationship = relationships.find((r) => r.id === selectedId);

  const selected = entity ?? attribute ?? relationship;
  const nodeType = entity ? 'entity' : attribute ? 'attribute' : relationship ? 'relationship' : null;

  const [editName, setEditName] = useState(selected?.name ?? '');
  const [prevId, setPrevId] = useState(selectedId);
  if (prevId !== selectedId) {
    setPrevId(selectedId);
    setEditName(selected?.name ?? '');
  }

  if (!selected || !nodeType) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="qc-icon-badge rounded-2xl p-4">
          <MousePointer2 className="h-6 w-6 opacity-50" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground/80">Select a node</p>
          <p className="mt-0.5 text-xs text-muted-foreground/80">Click any element to edit</p>
        </div>
        <div className="mt-4 w-full space-y-1.5">
          {[
            { icon: Box, label: 'Entity', desc: 'Rectangle', cls: 'text-primary' },
            { icon: Circle, label: 'Attribute', desc: 'Ellipse', cls: 'text-muted-foreground/80' },
            { icon: Diamond, label: 'Relationship', desc: 'Diamond', cls: 'text-primary' },
          ].map(({ icon: Icon, label, desc, cls }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-muted-foreground/80">
              <Icon className={`h-3.5 w-3.5 ${cls}`} />
              <span className="font-medium text-foreground/80">{label}</span>
              <span className="ml-auto text-muted-foreground/80">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handleSaveName = () => {
    if (!editName.trim()) return;
    if (nodeType === 'entity') store.updateEntity(selected.id, { name: editName.trim() });
    else if (nodeType === 'attribute') store.updateAttribute(selected.id, { name: editName.trim() });
    else if (nodeType === 'relationship') store.updateRelationship(selected.id, { name: editName.trim() });
  };

  const labelStyle = 'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80';
  const inputStyle =
    'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20';

  const isWeakEntity = nodeType === 'entity' && entity?.isWeak;
  const isAttribute = nodeType === 'attribute';

  const headerBg = isWeakEntity
    ? 'linear-gradient(135deg, color-mix(in oklab, var(--warning) 14%, var(--card)) 0%, transparent 100%)'
    : isAttribute
      ? 'linear-gradient(135deg, color-mix(in oklab, var(--border) 40%, var(--card)) 0%, transparent 100%)'
      : 'linear-gradient(135deg, color-mix(in oklab, var(--primary) 14%, var(--card)) 0%, transparent 100%)';

  const dotCss = isWeakEntity ? 'var(--warning)' : isAttribute ? 'var(--muted-foreground)' : 'var(--primary)';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: headerBg }}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: dotCss }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/80">
            {nodeType}
          </span>
        </div>
        <button
          onClick={() => store.setSelectedId(null)}
          className="rounded-md p-1 text-muted-foreground/80 transition-colors hover:bg-muted/80 hover:text-foreground/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Separator */}
      <div className="h-px bg-muted/60" />

      {/* Properties */}
      <div className="flex-1 space-y-5 overflow-auto p-4">
        {/* Name */}
        <div>
          <label className={labelStyle}>Name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            className={inputStyle}
          />
        </div>

        {/* Entity-specific */}
        {nodeType === 'entity' && entity && (
          <>
            <div>
              <label className={labelStyle}>Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => store.updateEntity(entity.id, { isWeak: false })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                    !entity.isWeak
                      ? 'border-primary/40 bg-primary/12 text-primary shadow-sm'
                      : 'border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground/90'
                  }`}
                >
                  Strong
                </button>
                <button
                  onClick={() => store.updateEntity(entity.id, { isWeak: true })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                    entity.isWeak
                      ? 'border-warning/40 bg-warning/12 text-warning shadow-sm'
                      : 'border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground/90'
                  }`}
                >
                  Weak
                </button>
              </div>
            </div>

            <div>
              <label className={labelStyle}>Attributes</label>
              {attributes.filter((a) => a.entityId === entity.id).length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground/80">
                  No attributes yet
                </p>
              ) : (
                <div className="space-y-0.5">
                  {attributes
                    .filter((a) => a.entityId === entity.id)
                    .map((a) => (
                      <button
                        key={a.id}
                        onClick={() => store.setSelectedId(a.id)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/80"
                      >
                        {a.kind === 'key' ? (
                          <KeyRound className="h-3 w-3 text-warning" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                        )}
                        <span className={`${a.kind === 'key' ? 'font-semibold text-warning underline underline-offset-2' : 'text-foreground/80'}`}>
                          {a.name}
                        </span>
                        <span className="ml-auto rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground/80">
                          {a.kind}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Attribute-specific */}
        {nodeType === 'attribute' && attribute && (
          <>
            <div>
              <label className={labelStyle}>Kind</label>
              <select
                value={attribute.kind}
                onChange={(e) => store.updateAttribute(attribute.id, { kind: e.target.value as AttributeKind })}
                className={inputStyle}
              >
                <option value="regular">Regular</option>
                <option value="key">Key (Primary Key)</option>
                <option value="multivalued">Multivalued</option>
                <option value="derived">Derived</option>
                <option value="composite">Composite</option>
              </select>
            </div>
            <div>
              <label className={labelStyle}>Belongs to</label>
              <select
                value={attribute.entityId}
                onChange={(e) => store.updateAttribute(attribute.id, { entityId: e.target.value })}
                className={inputStyle}
              >
                {entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Relationship-specific */}
        {nodeType === 'relationship' && relationship && (
          <>
            <div>
              <label className={labelStyle}>Cardinality</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['1:1', '1:N', 'M:N'] as Cardinality[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => store.updateRelationship(relationship.id, { cardinality: c })}
                    className={`rounded-lg border px-2 py-2 text-xs font-bold transition-all duration-150 ${
                      relationship.cardinality === c
                        ? 'border-primary/40 bg-primary/12 text-primary shadow-sm'
                        : 'border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground/90'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelStyle}>Connected Entities</label>
              <div className="space-y-1.5">
                {relationship.entities.map((eId, i) => {
                  const ent = entities.find((e) => e.id === eId);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-muted px-3 py-2 text-xs"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/80" />
                      <span className="font-medium text-foreground/80">{ent?.name ?? 'Unknown'}</span>
                      <span className="ml-auto rounded bg-primary/12 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {i === 0 ? relationship.cardinality.split(':')[0] : relationship.cardinality.split(':')[1]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Position */}
        <div>
          <label className={labelStyle}>Position</label>
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg border border-border bg-muted px-3 py-1.5">
              <span className="text-[10px] text-muted-foreground/80">X</span>
              <span className="ml-1.5 text-xs font-medium text-foreground/80">{Math.round(selected.position.x)}</span>
            </div>
            <div className="flex-1 rounded-lg border border-border bg-muted px-3 py-1.5">
              <span className="text-[10px] text-muted-foreground/80">Y</span>
              <span className="ml-1.5 text-xs font-medium text-foreground/80">{Math.round(selected.position.y)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <button
          onClick={() => { store.removeNode(selected.id); store.setSelectedId(null); }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-danger/35 py-2 text-xs font-medium text-danger transition-all duration-150 hover:border-danger/55 hover:bg-danger/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete {nodeType}
        </button>
      </div>
    </div>
  );
}
