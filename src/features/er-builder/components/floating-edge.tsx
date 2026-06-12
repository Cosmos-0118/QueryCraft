'use client';

import { type FC } from 'react';
import { BaseEdge, useInternalNode, type EdgeProps } from '@xyflow/react';

/**
 * Returns centre + half‑dims of a node from its internal representation.
 */
function getNodeBox(node: ReturnType<typeof useInternalNode>) {
  const w = node!.measured?.width ?? 0;
  const h = node!.measured?.height ?? 0;
  const cx = node!.internals.positionAbsolute.x + w / 2;
  const cy = node!.internals.positionAbsolute.y + h / 2;
  return { cx, cy, hw: w / 2, hh: h / 2 };
}

/**
 * Compute the point on a node's boundary that is closest to a target point,
 * using the correct geometry for each node type.
 *
 *  entity       → rectangle
 *  relationship → diamond (rotated rectangle / rhombus)
 *  attribute    → ellipse (pill shape)
 */
function getBoundaryPoint(
  node: NonNullable<ReturnType<typeof useInternalNode>>,
  targetX: number,
  targetY: number,
): [number, number] {
  const { cx, cy, hw, hh } = getNodeBox(node);
  const dx = targetX - cx;
  const dy = targetY - cy;

  if (dx === 0 && dy === 0) return [cx, cy];

  let s: number;

  switch (node.type) {
    case 'relationship': {
      // Diamond: |dx/hw| + |dy/hh| = 1
      const denom = Math.abs(dx) / hw + Math.abs(dy) / hh;
      s = denom > 0 ? 1 / denom : 1;
      break;
    }
    case 'attribute': {
      // Ellipse: (dx/hw)² + (dy/hh)² = 1
      const denom = Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
      s = denom > 0 ? 1 / denom : 1;
      break;
    }
    default: {
      // Rectangle
      const sx = Math.abs(dx) > 0 ? hw / Math.abs(dx) : Infinity;
      const sy = Math.abs(dy) > 0 ? hh / Math.abs(dy) : Infinity;
      s = Math.min(sx, sy);
      break;
    }
  }

  return [cx + dx * s, cy + dy * s];
}

export const FloatingEdge: FC<EdgeProps> = ({
  id,
  source,
  target,
  style,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  markerEnd,
}) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const sBox = getNodeBox(sourceNode);
  const tBox = getNodeBox(targetNode);

  const [sx, sy] = getBoundaryPoint(sourceNode, tBox.cx, tBox.cy);
  const [tx, ty] = getBoundaryPoint(targetNode, sBox.cx, sBox.cy);

  const path = `M ${sx} ${sy} L ${tx} ${ty}`;

  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
      label={label}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      markerEnd={markerEnd}
      labelX={(sx + tx) / 2}
      labelY={(sy + ty) / 2}
      interactionWidth={15}
    />
  );
};
