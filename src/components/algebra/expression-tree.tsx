'use client';

import type { AlgebraNode, AlgebraOperationType } from '@/types/algebra';
import { cn } from '@/lib/utils/helpers';
import { GitBranch } from 'lucide-react';

interface ExpressionTreeProps {
  tree: AlgebraNode;
  activeNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

/* ── Sizing ───────────────────────────────────────────── */

const NODE_H = 36;
const BADGE_W = 28;
const CHAR_W = 7;        // approximate width per character at 11px font
const MIN_LABEL_W = 50;
const NODE_PAD = 20;     // horizontal padding inside the node
const V_GAP = 28;
const H_GAP = 16;

/* ── Layout types ─────────────────────────────────────── */

interface TreeLayout {
  node: AlgebraNode;
  x: number;
  y: number;
  w: number;             // actual node width
  label: string;
  children: TreeLayout[];
}

/* ── Label formatting ─────────────────────────────────── */

function getLabel(node: AlgebraNode): string {
  if (node.operation === 'relation') return node.relationName ?? node.label;
  const detail = node.condition ?? node.columns?.join(', ') ?? node.newName ?? '';
  if (!detail) return node.label;
  return detail;
}

function nodeWidth(label: string): number {
  const textW = Math.max(label.length * CHAR_W, MIN_LABEL_W);
  return BADGE_W + textW + NODE_PAD;
}

/* ── Tree layout algorithm ────────────────────────────── */

function layoutTree(node: AlgebraNode, depth: number = 0): TreeLayout {
  const label = getLabel(node);
  const w = nodeWidth(label);

  if (node.children.length === 0) {
    return { node, x: 0, y: depth * (NODE_H + V_GAP), w, label, children: [] };
  }

  const childLayouts = node.children.map((c) => layoutTree(c, depth + 1));
  const subtreeWidths = childLayouts.map((c) => getSubtreeWidth(c));
  const totalW = subtreeWidths.reduce((a, b) => a + b, 0) + (childLayouts.length - 1) * H_GAP;

  let offsetX = -totalW / 2;
  childLayouts.forEach((cl, i) => {
    shiftX(cl, offsetX + subtreeWidths[i] / 2);
    offsetX += subtreeWidths[i] + H_GAP;
  });

  return { node, x: 0, y: depth * (NODE_H + V_GAP), w, label, children: childLayouts };
}

function getSubtreeWidth(layout: TreeLayout): number {
  if (layout.children.length === 0) return layout.w;
  const all = flattenLayout(layout);
  let minLeft = Infinity;
  let maxRight = -Infinity;
  for (const n of all) {
    minLeft = Math.min(minLeft, n.x - n.w / 2);
    maxRight = Math.max(maxRight, n.x + n.w / 2);
  }
  return maxRight - minLeft;
}

function shiftX(layout: TreeLayout, dx: number) {
  layout.x += dx;
  layout.children.forEach((c) => shiftX(c, dx));
}

function flattenLayout(layout: TreeLayout): TreeLayout[] {
  return [layout, ...layout.children.flatMap(flattenLayout)];
}

/* ── Operation metadata ───────────────────────────────── */

const OP_META: Record<AlgebraOperationType, { symbol: string; color: string }> = {
  selection:        { symbol: 'σ',  color: '#f59e0b' },
  projection:       { symbol: 'π',  color: '#3b82f6' },
  natural_join:     { symbol: '⋈',  color: '#10b981' },
  equi_join:        { symbol: '⋈',  color: '#10b981' },
  theta_join:       { symbol: '⋈θ', color: '#14b8a6' },
  left_outer_join:  { symbol: '⟕',  color: '#22d3ee' },
  right_outer_join: { symbol: '⟖',  color: '#22d3ee' },
  full_outer_join:  { symbol: '⟗',  color: '#06b6d4' },
  semi_join:        { symbol: '⋉',  color: '#34d399' },
  anti_join:        { symbol: '▷',  color: '#f43f5e' },
  union:            { symbol: '∪',  color: '#8b5cf6' },
  intersection:     { symbol: '∩',  color: '#a78bfa' },
  difference:       { symbol: '−',  color: '#ef4444' },
  division:         { symbol: '÷',  color: '#e879f9' },
  cartesian:        { symbol: '×',  color: '#f97316' },
  rename:           { symbol: 'ρ',  color: '#06b6d4' },
  aggregation:      { symbol: 'γ',  color: '#f472b6' },
  sort:             { symbol: 'τ',  color: '#fb923c' },
  relation:         { symbol: '▪',  color: '#71717a' },
};

/* ── Component ────────────────────────────────────────── */

export function ExpressionTree({ tree, activeNodeId, onNodeClick, className }: ExpressionTreeProps) {
  const root = layoutTree(tree);
  const allNodes = flattenLayout(root);

  // Compute SVG bounds from actual node widths
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let maxBottom = 0;
  for (const n of allNodes) {
    minLeft = Math.min(minLeft, n.x - n.w / 2);
    maxRight = Math.max(maxRight, n.x + n.w / 2);
    maxBottom = Math.max(maxBottom, n.y + NODE_H);
  }

  const pad = 20;
  const svgW = maxRight - minLeft + pad * 2;
  const svgH = maxBottom + pad * 2;
  const ox = -minLeft + pad;
  const oy = pad;

  return (
    <div className={cn('rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <GitBranch className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Expression Tree
        </span>
      </div>
      <div className="overflow-x-auto p-3">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="mx-auto block"
        >
          <defs>
            {allNodes.map((lay) => {
              const meta = OP_META[lay.node.operation] ?? OP_META.relation;
              return (
                <linearGradient key={`g-${lay.node.id}`} id={`g-${lay.node.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={meta.color} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={meta.color} stopOpacity={0.03} />
                </linearGradient>
              );
            })}
            <filter id="tree-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {renderEdges(root, ox, oy)}

          {/* Nodes */}
          {allNodes.map((lay) => {
            const isActive = activeNodeId === lay.node.id;
            const meta = OP_META[lay.node.operation] ?? OP_META.relation;
            const color = meta.color;
            const cx = lay.x + ox;
            const cy = lay.y + oy;
            const halfW = lay.w / 2;

            return (
              <g
                key={lay.node.id}
                transform={`translate(${cx},${cy})`}
                onClick={() => onNodeClick?.(lay.node.id)}
                className="cursor-pointer"
                filter={isActive ? 'url(#tree-glow)' : undefined}
              >
                {/* Node background */}
                <rect
                  x={-halfW}
                  y={0}
                  width={lay.w}
                  height={NODE_H}
                  rx={10}
                  fill={`url(#g-${lay.node.id})`}
                  stroke={isActive ? `${color}90` : `${color}30`}
                  strokeWidth={isActive ? 1 : 0.75}
                />

                {/* Symbol badge area */}
                <clipPath id={`clip-${lay.node.id}`}>
                  <rect x={-halfW} y={0} width={BADGE_W} height={NODE_H} rx={10} />
                  <rect x={-halfW + 10} y={0} width={BADGE_W - 10} height={NODE_H} />
                </clipPath>
                <rect
                  x={-halfW}
                  y={0}
                  width={BADGE_W}
                  height={NODE_H}
                  clipPath={`url(#clip-${lay.node.id})`}
                  fill={`${color}${isActive ? '18' : '0a'}`}
                />

                {/* Symbol text */}
                <text
                  x={-halfW + BADGE_W / 2}
                  y={NODE_H / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}
                  style={{ fontSize: 13, fontWeight: 700 }}
                >
                  {meta.symbol}
                </text>

                {/* Label text — positioned in the remaining space after badge */}
                <text
                  x={-halfW + BADGE_W + (lay.w - BADGE_W) / 2}
                  y={NODE_H / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isActive ? '#f4f4f5' : '#a1a1aa'}
                  style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, fontFamily: 'monospace' }}
                >
                  {lay.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ── Edge rendering ───────────────────────────────────── */

function renderEdges(layout: TreeLayout, ox: number, oy: number): React.ReactNode[] {
  const edges: React.ReactNode[] = [];
  for (const child of layout.children) {
    const x1 = layout.x + ox;
    const y1 = layout.y + oy + NODE_H;
    const x2 = child.x + ox;
    const y2 = child.y + oy;
    const midY = (y1 + y2) / 2;

    edges.push(
      <path
        key={`${layout.node.id}-${child.node.id}`}
        d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`}
        fill="none"
        stroke="#3f3f46"
        strokeWidth={1.2}
        strokeDasharray="4 3"
      />,
    );
    edges.push(...renderEdges(child, ox, oy));
  }
  return edges;
}
