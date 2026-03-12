'use client';

import type { AlgebraNode } from '@/types/algebra';
import { cn } from '@/lib/utils/helpers';

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

const NODE_W = 120;
const NODE_H = 40;
const V_GAP = 60;
const H_GAP = 20;

function layoutTree(node: AlgebraNode, depth: number = 0): TreeLayout {
  if (node.children.length === 0) {
    return { node, x: 0, y: depth * (NODE_H + V_GAP), children: [] };
  }

  const childLayouts = node.children.map((c) => layoutTree(c, depth + 1));

  // Calculate widths
  const widths = childLayouts.map((c) => getWidth(c));
  const totalW = widths.reduce((a, b) => a + b, 0) + (childLayouts.length - 1) * H_GAP;

  let offsetX = -totalW / 2;
  childLayouts.forEach((cl, i) => {
    const w = widths[i];
    shiftX(cl, offsetX + w / 2);
    offsetX += w + H_GAP;
  });

  return {
    node,
    x: 0,
    y: depth * (NODE_H + V_GAP),
    children: childLayouts,
  };
}

function getWidth(layout: TreeLayout): number {
  if (layout.children.length === 0) return NODE_W;
  const allNodes = flattenLayout(layout);
  const minX = Math.min(...allNodes.map((n) => n.x));
  const maxX = Math.max(...allNodes.map((n) => n.x));
  return maxX - minX + NODE_W;
}

function shiftX(layout: TreeLayout, dx: number) {
  layout.x += dx;
  layout.children.forEach((c) => shiftX(c, dx));
}

function flattenLayout(layout: TreeLayout): TreeLayout[] {
  return [layout, ...layout.children.flatMap(flattenLayout)];
}

export function ExpressionTree({ tree, activeNodeId, onNodeClick, className }: ExpressionTreeProps) {
  const root = layoutTree(tree);
  const allNodes = flattenLayout(root);
  const minX = Math.min(...allNodes.map((n) => n.x));
  const maxX = Math.max(...allNodes.map((n) => n.x));
  const maxY = Math.max(...allNodes.map((n) => n.y));

  const padding = 30;
  const svgW = maxX - minX + NODE_W + padding * 2;
  const svgH = maxY + NODE_H + padding * 2;
  const offsetX = -minX + padding;
  const offsetY = padding;

  return (
    <div className={cn('overflow-auto rounded-lg border border-border bg-card', className)}>
      <div className="border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Expression Tree
        </span>
      </div>
      <svg width={svgW} height={svgH} className="mx-auto block">
        {renderEdges(root, offsetX, offsetY)}
        {allNodes.map((lay) => (
          <g
            key={lay.node.id}
            transform={`translate(${lay.x + offsetX},${lay.y + offsetY})`}
            onClick={() => onNodeClick?.(lay.node.id)}
            className="cursor-pointer"
          >
            <rect
              x={-NODE_W / 2}
              y={0}
              width={NODE_W}
              height={NODE_H}
              rx={8}
              className={cn(
                'fill-muted stroke-border stroke-1 transition-colors',
                activeNodeId === lay.node.id && 'fill-primary/20 stroke-primary stroke-2',
              )}
            />
            <text
              x={0}
              y={NODE_H / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              className={cn(
                'fill-foreground text-xs font-medium',
                activeNodeId === lay.node.id && 'fill-primary',
              )}
            >
              {lay.node.label.length > 14 ? lay.node.label.slice(0, 13) + '…' : lay.node.label}
            </text>
          </g>
        ))}
      </svg>
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
        className="stroke-border stroke-1"
      />,
    );
    edges.push(...renderEdges(child, ox, oy));
  }
  return edges;
}
