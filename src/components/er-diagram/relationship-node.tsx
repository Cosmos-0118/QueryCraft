'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface RelationshipData {
  label: string;
  cardinality: string;
}

export function RelationshipNode({ data }: NodeProps) {
  const { label } = data as unknown as RelationshipData;
  return (
    <div className="relative flex h-12 w-24 items-center justify-center">
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <Handle type="source" position={Position.Right} className="!bg-primary" />
      <svg viewBox="0 0 100 50" className="absolute inset-0 h-full w-full">
        <polygon
          points="50,2 98,25 50,48 2,25"
          className="fill-card stroke-primary"
          strokeWidth={2}
        />
      </svg>
      <span className="relative z-10 text-xs font-semibold">{label}</span>
    </div>
  );
}
