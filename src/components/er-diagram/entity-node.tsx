'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface EntityData {
  label: string;
  isWeak: boolean;
}

export function EntityNode({ data }: NodeProps) {
  const { label, isWeak } = data as unknown as EntityData;
  return (
    <div
      className={`rounded-md border-2 bg-card px-6 py-3 text-sm font-bold ${
        isWeak ? 'border-double border-[3px] border-amber-500' : 'border-primary'
      }`}
    >
      <Handle type="source" position={Position.Right} className="!bg-primary" />
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <Handle type="source" position={Position.Top} id="top" className="!bg-primary" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="!bg-primary" />
      {label}
    </div>
  );
}
