'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface RelationshipData {
  label: string;
  cardinality: string;
}

export const RelationshipNode = memo(function RelationshipNode({ data, selected }: NodeProps) {
  const { label, cardinality } = data as unknown as RelationshipData;

  return (
    <div className="group relative flex h-[80px] w-[160px] items-center justify-center">
      {/* Glow behind diamond when selected */}
      {selected && (
        <div
          className="pointer-events-none absolute inset-3 blur-lg"
          style={{ background: 'radial-gradient(ellipse, color-mix(in oklab, var(--primary) 28%, transparent) 0%, transparent 70%)' }}
        />
      )}

      <svg
        viewBox="0 0 160 80"
        className="absolute inset-0 h-full w-full overflow-visible"
        style={{
          filter: selected
            ? 'drop-shadow(0 0 8px color-mix(in oklab, var(--primary) 38%, transparent))'
            : 'drop-shadow(0 2px 5px color-mix(in oklab, var(--shadow-color, rgba(0,0,0,0.25)) 60%, transparent))',
        }}
      >
        <polygon
          points="80,4 156,40 80,76 4,40"
          style={{
            fill: selected
              ? 'color-mix(in oklab, var(--primary) 16%, var(--card))'
              : 'var(--card)',
            stroke: selected
              ? 'color-mix(in oklab, var(--primary) 60%, transparent)'
              : 'var(--border)',
            strokeWidth: selected ? 2 : 1.2,
          }}
        />
      </svg>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-0.5 px-4">
        <span className="max-w-[100px] truncate text-center text-[11px] font-semibold leading-tight text-foreground/80">{label}</span>
        <span className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-px text-[9px] font-bold leading-none text-primary">
          {cardinality}
        </span>
      </div>

      {/* Handles — invisible, only for React Flow edge routing */}
      <Handle type="target" position={Position.Left} isConnectable={false} className="!h-2 !w-2 !rounded-full !border-0 !bg-transparent !opacity-0" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="!h-2 !w-2 !rounded-full !border-0 !bg-transparent !opacity-0" />
      <Handle type="target" position={Position.Top} id="top" isConnectable={false} className="!h-2 !w-2 !rounded-full !border-0 !bg-transparent !opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={false} className="!h-2 !w-2 !rounded-full !border-0 !bg-transparent !opacity-0" />
    </div>
  );
});
