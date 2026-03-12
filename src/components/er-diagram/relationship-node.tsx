'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface RelationshipData {
  label: string;
  cardinality: string;
}

export const RelationshipNode = memo(function RelationshipNode({ data, selected }: NodeProps) {
  const { label, cardinality } = data as unknown as RelationshipData;

  // Unique gradient ID to avoid SVG id collisions across nodes
  const gradId = `dg-${label.replace(/\W/g, '')}-${selected ? 's' : 'd'}`;

  return (
    <div className="group relative flex h-[80px] w-[160px] items-center justify-center">
      {/* Glow behind diamond when selected */}
      {selected && (
        <div className="pointer-events-none absolute inset-3 blur-lg" style={{
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.3) 0%, transparent 70%)',
        }} />
      )}

      <svg
        viewBox="0 0 160 80"
        className="absolute inset-0 h-full w-full overflow-visible"
        style={{ filter: selected ? 'drop-shadow(0 0 10px rgba(139,92,246,0.35))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={selected ? 'rgba(139,92,246,0.15)' : 'rgba(39,39,42,0.95)'} />
            <stop offset="100%" stopColor={selected ? 'rgba(139,92,246,0.05)' : 'rgba(24,24,27,0.95)'} />
          </linearGradient>
        </defs>
        <polygon
          points="80,4 156,40 80,76 4,40"
          fill={`url(#${gradId})`}
          stroke={selected ? 'rgba(139,92,246,0.6)' : 'rgba(63,63,70,0.5)'}
          strokeWidth={selected ? 2 : 1.2}
        />
      </svg>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-0.5 px-4">
        <span className="max-w-[100px] truncate text-center text-[11px] font-semibold leading-tight text-zinc-200">{label}</span>
        <span className="rounded-sm bg-violet-500/15 px-1.5 py-px text-[9px] font-bold leading-none text-violet-300">
          {cardinality}
        </span>
      </div>

      {/* Handles — positioned at diamond tips, invisible (only for edge connections) */}
      <Handle type="target" position={Position.Left} className="!-left-0.5 !h-1.5 !w-1.5 !rounded-full !border-0 !bg-violet-400/60" />
      <Handle type="source" position={Position.Right} className="!-right-0.5 !h-1.5 !w-1.5 !rounded-full !border-0 !bg-violet-400/60" />
      <Handle type="target" position={Position.Top} id="top" className="!-top-0.5 !h-1.5 !w-1.5 !rounded-full !border-0 !bg-violet-400/60" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!-bottom-0.5 !h-1.5 !w-1.5 !rounded-full !border-0 !bg-violet-400/60" />
    </div>
  );
});
