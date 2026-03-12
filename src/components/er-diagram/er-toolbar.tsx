'use client';

import { useState, useRef, useEffect } from 'react';
import { useERStore } from '@/stores/er-store';
import type { AttributeKind, Cardinality } from '@/types/er-diagram';
import {
  Box,
  Circle,
  Diamond,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Plus,
  X,
  Key,
  CopySlash,
  Layers,
  GitFork,
} from 'lucide-react';

interface ERToolbarProps {
  onExport: () => void;
}

/* ══════════════════════════════════════════════════════════════
   Safe Position System
   ═══════════════════════════════════════════════════════════ */

const POS_MIN = -10000;
const POS_MAX = 10000;

/** Clamps a position and replaces NaN / ±Infinity with a fallback. */
function safePos(x: number, y: number, fallbackX = 200, fallbackY = 200): { x: number; y: number } {
  return {
    x: Number.isFinite(x) ? Math.max(POS_MIN, Math.min(POS_MAX, Math.round(x))) : fallbackX,
    y: Number.isFinite(y) ? Math.max(POS_MIN, Math.min(POS_MAX, Math.round(y))) : fallbackY,
  };
}

/* ── Entity Placement ─────────────────────────────────────── */

const ENTITY_W = 180;
const ENTITY_H = 80;
const GRID_GAP_X = 340;
const GRID_GAP_Y = 300;
const GRID_COLS = 4;
const GRID_ORIGIN = { x: 80, y: 100 };

function findNextEntitySlot(existing: { x: number; y: number }[]) {
  for (let i = 0; i < 60; i++) {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    const cx = GRID_ORIGIN.x + col * GRID_GAP_X;
    const cy = GRID_ORIGIN.y + row * GRID_GAP_Y;

    const overlaps = existing.some(
      (p) => Math.abs(p.x - cx) < ENTITY_W + 60 && Math.abs(p.y - cy) < ENTITY_H + 60,
    );
    if (!overlaps) return safePos(cx, cy);
  }
  return safePos(GRID_ORIGIN.x, GRID_ORIGIN.y + 400);
}

/* ── Attribute Placement (outward fan) ────────────────────── */

const ATTR_RADIUS = 190;
const ATTR_ANGLE_STEP = (40 * Math.PI) / 180; // 40° between attrs

/**
 * Computes the outward direction from the centroid of all entities
 * toward the given entity. Attributes fan around this direction.
 */
function computeOutwardAngle(
  entityPos: { x: number; y: number },
  allEntities: { position: { x: number; y: number } }[],
): number {
  if (allEntities.length <= 1) return -Math.PI / 2; // straight up if only one entity

  let cx = 0;
  let cy = 0;
  for (const e of allEntities) {
    cx += e.position.x + ENTITY_W / 2;
    cy += e.position.y + ENTITY_H / 2;
  }
  cx /= allEntities.length;
  cy /= allEntities.length;

  const ex = entityPos.x + ENTITY_W / 2;
  const ey = entityPos.y + ENTITY_H / 2;

  const dx = ex - cx;
  const dy = ey - cy;

  // If entity is at the centroid (very rare), default to upward
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return -Math.PI / 2;

  return Math.atan2(dy, dx);
}

/**
 * Fan attribute position using alternating left/right from the outward angle.
 * index 0 → center, 1 → left, 2 → right, 3 → further left, etc.
 */
function fanAttributePosition(
  entityPos: { x: number; y: number },
  allEntities: { position: { x: number; y: number } }[],
  siblingIndex: number,
): { x: number; y: number } {
  const outAngle = computeOutwardAngle(entityPos, allEntities);

  let angle: number;
  if (siblingIndex === 0) {
    angle = outAngle;
  } else {
    const side = siblingIndex % 2 === 1 ? -1 : 1;
    const level = Math.ceil(siblingIndex / 2);
    angle = outAngle + side * level * ATTR_ANGLE_STEP;
  }

  const cx = entityPos.x + ENTITY_W / 2;
  const cy = entityPos.y + ENTITY_H / 2;
  // Offset by radius, then shift back by half of typical attribute node size (~50x20)
  const x = cx + Math.cos(angle) * ATTR_RADIUS - 50;
  const y = cy + Math.sin(angle) * ATTR_RADIUS - 18;

  return safePos(x, y);
}

/* ── Relationship Placement (midpoint) ────────────────────── */

function computeRelationshipPosition(
  e1Pos: { x: number; y: number },
  e2Pos: { x: number; y: number },
  existingRelationships: { position: { x: number; y: number } }[],
): { x: number; y: number } {
  const mx = (e1Pos.x + e2Pos.x) / 2;
  const my = (e1Pos.y + e2Pos.y) / 2;

  // Offset relationship diamond to sit above the midpoint line (not on top of edges)
  // Find direction perpendicular to the entity-entity line
  const dx = e2Pos.x - e1Pos.x;
  const dy = e2Pos.y - e1Pos.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  // perpendicular (90° CCW) — normalized
  const perpX = len > 1 ? -dy / len : 0;
  const perpY = len > 1 ? dx / len : -1;

  // Base position: midpoint shifted slightly along perpendicular
  let rx = mx + perpX * 10;
  let ry = my + perpY * 10;

  // Check for nearby existing relationships and nudge if overlapping
  const NUDGE = 80;
  let attempts = 0;
  while (attempts < 8) {
    const tooClose = existingRelationships.some(
      (r) => Math.abs(r.position.x - rx) < 80 && Math.abs(r.position.y - ry) < 50,
    );
    if (!tooClose) break;
    // Nudge along perpendicular direction
    rx += perpX * NUDGE;
    ry += perpY * NUDGE;
    attempts++;
  }

  return safePos(rx, ry);
}

/* ── Kind / Cardinality Configs ──────────────────────────── */

const ATTR_KINDS: { value: AttributeKind; label: string; icon: typeof Key; color: string; bg: string }[] = [
  { value: 'regular', label: 'Regular', icon: Circle, color: 'text-zinc-400', bg: 'bg-zinc-800/60 border-zinc-700/50' },
  { value: 'key', label: 'Key (PK)', icon: Key, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  { value: 'multivalued', label: 'Multi', icon: Layers, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  { value: 'derived', label: 'Derived', icon: CopySlash, color: 'text-zinc-500', bg: 'bg-zinc-800/40 border-zinc-600/40 border-dashed' },
  { value: 'composite', label: 'Composite', icon: GitFork, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
];

const CARDINALITIES: { value: Cardinality; label: string; desc: string }[] = [
  { value: '1:1', label: '1 : 1', desc: 'One to One' },
  { value: '1:N', label: '1 : N', desc: 'One to Many' },
  { value: 'M:N', label: 'M : N', desc: 'Many to Many' },
];

/* ══════════════════════════════════════════════════════════════
   Toolbar Component
   ═══════════════════════════════════════════════════════════ */

export function ERToolbar({ onExport }: ERToolbarProps) {
  const store = useERStore();
  const [mode, setMode] = useState<'entity' | 'relationship' | 'attribute' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [isWeak, setIsWeak] = useState(false);
  const [attrKind, setAttrKind] = useState<AttributeKind>('regular');
  const [attrEntity, setAttrEntity] = useState('');
  const [relEntity1, setRelEntity1] = useState('');
  const [relEntity2, setRelEntity2] = useState('');
  const [cardinality, setCardinality] = useState<Cardinality>('1:N');

  // Focus input when form opens
  useEffect(() => {
    if (mode && inputRef.current) inputRef.current.focus();
  }, [mode]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode) { setMode(null); setName(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode]);

  const handleAdd = () => {
    if (!name.trim()) return;

    if (mode === 'entity') {
      const existingPos = store.entities.map((e) => e.position);
      const pos = findNextEntitySlot(existingPos);
      store.addEntity(name.trim(), pos, isWeak);
    } else if (mode === 'attribute') {
      const entity = store.entities.find((e) => e.id === attrEntity);
      if (!entity) return; // guard: entity may have been deleted
      const siblingCount = store.attributes.filter((a) => a.entityId === attrEntity).length;
      const pos = fanAttributePosition(entity.position, store.entities, siblingCount);
      store.addAttribute(name.trim(), attrKind, attrEntity, pos);
    } else if (mode === 'relationship') {
      if (relEntity1 === relEntity2) return; // guard: same entity
      const e1 = store.entities.find((e) => e.id === relEntity1);
      const e2 = store.entities.find((e) => e.id === relEntity2);
      if (!e1 || !e2) return; // guard: entities may have been deleted
      const pos = computeRelationshipPosition(e1.position, e2.position, store.relationships);
      store.addRelationship(name.trim(), cardinality, [relEntity1, relEntity2], pos);
    }

    setName('');
    setIsWeak(false);
    setAttrKind('regular');
  };

  const openMode = (m: 'entity' | 'attribute' | 'relationship') => {
    if (mode === m) { setMode(null); return; }
    setName('');
    setMode(m);
    if (m === 'attribute' && store.entities.length > 0) setAttrEntity(store.entities[0].id);
    if (m === 'relationship' && store.entities.length >= 2) {
      setRelEntity1(store.entities[0].id);
      setRelEntity2(store.entities[1].id);
    }
  };

  const iconBtn =
    'inline-flex items-center justify-center rounded-lg p-2 text-zinc-500 transition-all duration-150 hover:bg-zinc-800/60 hover:text-zinc-300 disabled:pointer-events-none disabled:opacity-25';

  return (
    <div className="space-y-2">
      {/* Main bar */}
      <div
        className="flex items-center gap-1 rounded-xl border border-zinc-800/60 px-2 py-1.5"
        style={{ background: 'linear-gradient(180deg, rgba(24,24,27,0.8) 0%, rgba(24,24,27,0.95) 100%)', backdropFilter: 'blur(12px)' }}
      >
        {/* Add buttons */}
        <div className="flex items-center gap-0.5 rounded-lg bg-zinc-800/40 p-0.5">
          {(['entity', 'attribute', 'relationship'] as const).map((m) => {
            const Icon = m === 'entity' ? Box : m === 'attribute' ? Circle : Diamond;
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => openMode(m)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-violet-500/15 text-violet-300 shadow-sm shadow-violet-500/10'
                    : 'text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            );
          })}
        </div>

        <div className="mx-1 h-5 w-px bg-zinc-800" />

        <button onClick={store.undo} disabled={!store.canUndo} className={iconBtn} title="Undo (⌘Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={store.redo} disabled={!store.canRedo} className={iconBtn} title="Redo (⌘⇧Z)">
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-5 w-px bg-zinc-800" />

        <button
          onClick={onExport}
          disabled={store.entities.length === 0}
          className={`${iconBtn} gap-1.5 px-2.5 text-[11px] font-medium`}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="text-zinc-400">Export</span>
        </button>

        <div className="flex-1" />

        {store.selectedId && (
          <button
            onClick={() => { store.removeNode(store.selectedId!); store.setSelectedId(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-red-400/80 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        )}
        <button
          onClick={store.clear}
          disabled={store.entities.length === 0 && store.attributes.length === 0 && store.relationships.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-red-400/60 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400 disabled:pointer-events-none disabled:opacity-25"
        >
          Clear All
        </button>
      </div>

      {/* ── Compact Inline Add Form ─────────────────────── */}
      {mode && (
        <div
          className="flex items-center gap-2 rounded-xl border border-zinc-800/60 px-3 py-2"
          style={{ background: 'linear-gradient(180deg, rgba(24,24,27,0.9) 0%, rgba(18,18,21,0.95) 100%)', backdropFilter: 'blur(12px)' }}
        >
          {/* Mode indicator dot */}
          <div
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{
              background: mode === 'entity' ? '#8b5cf6' : mode === 'attribute' ? '#3b82f6' : '#ec4899',
            }}
          />

          {/* ── Entity Form ──────────────────────── */}
          {mode === 'entity' && (
            <>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/40"
                placeholder="Entity name…"
              />
              <button
                type="button"
                onClick={() => setIsWeak(!isWeak)}
                className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-all ${
                  isWeak
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    : 'border-zinc-800 text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <div
                  className={`h-2.5 w-2.5 rounded-sm border transition-all ${
                    isWeak ? 'border-amber-400 bg-amber-400' : 'border-zinc-600'
                  }`}
                />
                Weak
              </button>
            </>
          )}

          {/* ── Attribute Form ───────────────────── */}
          {mode === 'attribute' && store.entities.length === 0 && (
            <p className="flex-1 text-[11px] text-zinc-500">Add an entity first</p>
          )}
          {mode === 'attribute' && store.entities.length > 0 && (
            <>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/40"
                placeholder="Attribute name…"
              />
              <select
                value={attrEntity}
                onChange={(e) => setAttrEntity(e.target.value)}
                className="shrink-0 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500/40"
              >
                {store.entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <div className="flex shrink-0 gap-0.5">
                {ATTR_KINDS.map((k) => {
                  const Icon = k.icon;
                  const active = attrKind === k.value;
                  return (
                    <button
                      key={k.value}
                      onClick={() => setAttrKind(k.value)}
                      title={k.label}
                      className={`rounded-md border p-1.5 transition-all ${
                        active
                          ? `${k.bg} ${k.color}`
                          : 'border-zinc-800/60 text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Relationship Form ────────────────── */}
          {mode === 'relationship' && store.entities.length < 2 && (
            <p className="flex-1 text-[11px] text-zinc-500">Need at least 2 entities</p>
          )}
          {mode === 'relationship' && store.entities.length >= 2 && (
            <>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/40"
                placeholder="Relationship name…"
              />
              <select
                value={relEntity1}
                onChange={(e) => setRelEntity1(e.target.value)}
                className="shrink-0 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500/40"
              >
                {store.entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <div className="flex shrink-0 gap-0.5">
                {CARDINALITIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCardinality(c.value)}
                    title={c.desc}
                    className={`rounded-md border px-2 py-1 text-[10px] font-bold tabular-nums transition-all ${
                      cardinality === c.value
                        ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                        : 'border-zinc-800 text-zinc-500 hover:text-zinc-400'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <select
                value={relEntity2}
                onChange={(e) => setRelEntity2(e.target.value)}
                className="shrink-0 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500/40"
              >
                {store.entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              {relEntity1 === relEntity2 && (
                <span className="shrink-0 text-[10px] text-amber-400/80">⚠ Same</span>
              )}
            </>
          )}

          {/* Add button + close — shared by all modes */}
          <button
            onClick={handleAdd}
            disabled={
              !name.trim() ||
              (mode === 'attribute' && (!attrEntity || store.entities.length === 0)) ||
              (mode === 'relationship' && (!relEntity1 || !relEntity2 || relEntity1 === relEntity2 || store.entities.length < 2))
            }
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white transition-all disabled:opacity-30"
            style={{
              background: name.trim()
                ? mode === 'entity'
                  ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                  : mode === 'attribute'
                  ? 'linear-gradient(135deg, #3b82f6, #6d28d9)'
                  : 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                : 'rgba(63,63,70,0.5)',
            }}
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
          <button
            onClick={() => { setMode(null); setName(''); }}
            className="shrink-0 rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
