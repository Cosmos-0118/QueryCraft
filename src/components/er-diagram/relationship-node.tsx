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
    <div className="group relative flex h-[72px] w-[144px] items-center justify-center">
      {/* Glow behind diamond when selected */}
      {selected && (
        <div className="pointer-events-none absolute inset-2 blur-lg" style={{
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.25) 0%, transparent 70%)',
        }} />
      )}

      <svg
        viewBox="0 0 144 72"
        className="absolute inset-0 h-full w-full"
        style={{ filter: selected ? 'drop-shadow(0 0 8px rgba(139,92,246,0.3))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
      >
        <defs>
          <linearGradient id={`diamond-fill-${selected ? 'sel' : 'def'}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={selected ? 'rgba(139,92,246,0.12)' : 'rgba(39,39,42,1)'} />
            <stop offset="100%" stopColor={selected ? 'rgba(139,92,246,0.04)' : 'rgba(24,24,27,1)'} />
          </linearGradient>
        </defs>
        <polygon
          points="72,4 140,36 72,68 4,36"
          fill={`url(#diamond-fill-${selected ? 'sel' : 'def'})`}
          stroke={selected ? 'rgba(139,92,246,0.6)' : 'rgba(63,63,70,0.7)'}
          strokeWidth={selected ? 2 : 1.5}
        />
      </svg>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-0.5">
        <span className="text-[11px] font-semibold leading-tight text-zinc-200">{label}</span>
        <span className="rounded-sm bg-violet-500/15 px-1.5 py-px text-[9px] font-bold leading-none text-violet-300">
          {cardinality}
        </span>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !rounded-full !border-[1.5px] !border-[#18181b] !bg-violet-400" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !rounded-full !border-[1.5px] !border-[#18181b] !bg-violet-400" />
      <Handle type="target" position={Position.Top} id="top" className="!h-2 !w-2 !rounded-full !border-[1.5px] !border-[#18181b] !bg-violet-400" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!h-2 !w-2 !rounded-full !border-[1.5px] !border-[#18181b] !bg-violet-400" />
    </div>
  );
});
