'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AttributeKind } from '@/types/er-diagram';

interface AttributeData {
  label: string;
  kind: AttributeKind;
}

const kindStyles: Record<AttributeKind, string> = {
  regular: 'border-border',
  key: 'border-yellow-500 underline',
  multivalued: 'border-double border-[3px] border-blue-500',
  derived: 'border-dashed border-muted-foreground',
  composite: 'border-green-500',
};

export function AttributeNode({ data }: NodeProps) {
  const { label, kind } = data as unknown as AttributeData;
  return (
    <div
      className={`rounded-full border-2 bg-card px-4 py-1.5 text-xs font-medium ${kindStyles[kind]}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-border" />
      <span className={kind === 'key' ? 'underline' : ''}>{label}</span>
    </div>
  );
}
