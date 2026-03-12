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

interface TreeLayout {
  node: AlgebraNode;
  x: number;
  y: number;
  children: TreeLayout[];
}

const NODE_W = 130;
const NODE_H = 44;
const V_GAP = 56;
const H_GAP = 24;

function layoutTree(node: AlgebraNode, depth: number = 0): TreeLayout {
  if (node.children.length === 0) {
    return { node, x: 0, y: depth * (NODE_H + V_GAP), children: [] };
  }

  const childLayouts = node.children.map((c) => layoutTree(c, depth + 1));
  const widths = childLayouts.map((c) => getWidth(c));
  const totalW = widths.reduce((a, b) => a + b, 0) + (childLayouts.length - 1) * H_GAP;

  let offsetX = -totalW / 2;
  childLayouts.forEach((cl, i) => {
    const w = widths[i];
    shiftX(cl, offsetX + w / 2);
    offsetX += w + H_GAP;
  });

  return { node, x: 0, y: depth * (NODE_H + V_GAP), children: childLayouts };
}

function getWidth(layout: TreeLayout): number {
  if (layout.children.length === 0) return NODE_W;
  const all = flattenLayout(layout);
  const minX = Math.min(...all.map((n) => n.x));
  const maxX = Math.max(...all.map((n) => n.x));
  return maxX - minX + NODE_W;
}

function shiftX(layout: TreeLayout, dx: number) {
  layout.x += dx;
  layout.children.forEach((c) => shiftX(c, dx));
}

function flattenLayout(layout: TreeLayout): TreeLayout[] {
  return [layout, ...layout.children.flatMap(flattenLayout)];
}

const OP_COLORS: Record<AlgebraOperationType, string> = {
  selection: '#f59e0b',
  projection: '#3b82f6',
  natural_join: '#10b981',
  equi_join: '#10b981',
  theta_join: '#10b981',
  union: '#8b5cf6',
  difference: '#ef4444',
  cartesian: '#f97316',
  rename: '#06b6d4',
  relation: '#a1a1aa',
};

export function ExpressionTree({ tree, activeNodeId, onNodeClick, className }: ExpressionTreeProps) {
  const root = layoutTree(tree);
  const allNodes = flattenLayout(root);
  const minX = Math.min(...allNodes.map((n) => n.x));
  const maxX = Math.max(...allNodes.map((n) => n.x));
  const maxY = Math.max(...allNodes.map((n) => n.y));

  const padding = 30;
  const svgW = maxX - minX + NODE_W + padding * 2;
  const svgH = maxY + NODE_H + padding * 2;
  const ox = -minX + padding;
  const oy = padding;

  return (
    <div className={cn('overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <GitBranch className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Expression Tree
        </span>
      </div>
      <div className="overflow-auto p-2">
        <svg width={svgW} height={svgH} className="mx-auto block">
          {renderEdges(root, ox, oy)}
          {allNodes.map((lay) => {
            const isActive = activeNodeId === lay.node.id;
            const color = OP_COLORS[lay.node.operation] ?? '#a1a1aa';

            return (
              <g
                key={lay.node.id}
                transform={`translate(${lay.x + ox},${lay.y + oy})`}
                onClick={() => onNodeClick?.(lay.node.id)}
                className="cursor-pointer"
              >
                <rect
                  x={-NODE_W / 2}
                  y={0}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill={isActive ? `${color}33` : `${color}18`}
                  stroke={isActive ? color : `${color}55`}
                  strokeWidth={isActive ? 2 : 1}
                />
                <text
                  x={0}
                  y={NODE_H / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isActive ? color : '#d4d4d8'}
                  style={{ fontSize: 12, fontWeight: 500 }}
                >
                  {lay.node.label.length > 15
                    ? lay.node.label.slice(0, 14) + '…'
                    : lay.node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function renderEdges(layout: TreeLayout, ox: number, oy: number): React.ReactNode[] {
  const edges: React.ReactNode[] = [];
  for (const child of layout.children) {
    edges.push(
      <line
        key={`${layout.node.id}-${child.node.id}`}
        x1={layout.x + ox}
        y1={layout.y + oy + NODE_H}
        x2={child.x + ox}
        y2={child.y + oy}
        stroke="#3f3f46"
        strokeWidth={1.5}
      />,
    );
    edges.push(...renderEdges(child, ox, oy));
  }
  return edges;
}
