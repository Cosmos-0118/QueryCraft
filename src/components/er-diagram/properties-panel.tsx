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
        <div
          className="rounded-2xl p-4"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 100%)' }}
        >
          <MousePointer2 className="h-6 w-6 text-violet-400/50" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700">Select a node</p>
          <p className="mt-0.5 text-xs text-slate-500">Click any element to edit</p>
        </div>
        <div className="mt-4 w-full space-y-1.5">
          {[
            { icon: Box, label: 'Entity', desc: 'Rectangle', color: 'text-violet-400' },
            { icon: Circle, label: 'Attribute', desc: 'Ellipse', color: 'text-slate-500' },
            { icon: Diamond, label: 'Relationship', desc: 'Diamond', color: 'text-violet-400' },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-500">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <span className="font-medium text-slate-700">{label}</span>
              <span className="ml-auto text-slate-500">{desc}</span>
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

  const labelStyle = 'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500';
  const inputStyle =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-300';

  const accentColor =
    nodeType === 'entity'
      ? entity?.isWeak ? 'amber' : 'violet'
      : nodeType === 'relationship'
        ? 'violet'
        : 'zinc';

  const dotColor =
    accentColor === 'violet' ? 'bg-violet-400' : accentColor === 'amber' ? 'bg-amber-400' : 'bg-zinc-400';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          background:
            accentColor === 'violet'
              ? 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, transparent 100%)'
              : accentColor === 'amber'
                ? 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, transparent 100%)'
                : 'linear-gradient(135deg, rgba(148,163,184,0.18) 0%, transparent 100%)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full ${dotColor}`} />
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700">
            {nodeType}
          </span>
        </div>
        <button
          onClick={() => store.setSelectedId(null)}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Separator */}
      <div className="h-px bg-slate-200" />

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
                      ? 'border-violet-300 bg-violet-100 text-violet-700 shadow-sm'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  Strong
                </button>
                <button
                  onClick={() => store.updateEntity(entity.id, { isWeak: true })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                    entity.isWeak
                      ? 'border-amber-300 bg-amber-100 text-amber-700 shadow-sm'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  Weak
                </button>
              </div>
            </div>

            <div>
              <label className={labelStyle}>Attributes</label>
              {attributes.filter((a) => a.entityId === entity.id).length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-center text-xs text-slate-500">
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
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-slate-100"
                      >
                        {a.kind === 'key' ? (
                          <KeyRound className="h-3 w-3 text-yellow-600" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        )}
                        <span className={`${a.kind === 'key' ? 'font-semibold text-yellow-700 underline underline-offset-2' : 'text-slate-700'}`}>
                          {a.name}
                        </span>
                        <span className="ml-auto rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
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
                        ? 'border-violet-300 bg-violet-100 text-violet-700 shadow-sm'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
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
                      className="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                      <span className="font-medium text-slate-700">{ent?.name ?? 'Unknown'}</span>
                      <span className="ml-auto rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
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
            <div className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5">
              <span className="text-[10px] text-slate-500">X</span>
              <span className="ml-1.5 text-xs font-medium text-slate-700">{Math.round(selected.position.x)}</span>
            </div>
            <div className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5">
              <span className="text-[10px] text-slate-500">Y</span>
              <span className="ml-1.5 text-xs font-medium text-slate-700">{Math.round(selected.position.y)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 p-3">
        <button
          onClick={() => { store.removeNode(selected.id); store.setSelectedId(null); }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300 py-2 text-xs font-medium text-rose-700 transition-all duration-150 hover:border-rose-400 hover:bg-rose-100 hover:text-rose-800"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete {nodeType}
        </button>
      </div>
    </div>
  );
}
