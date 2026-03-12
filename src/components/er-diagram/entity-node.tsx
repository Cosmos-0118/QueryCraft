'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface EntityData {
  label: string;
  isWeak: boolean;
}

export const EntityNode = memo(function EntityNode({ data, selected }: NodeProps) {
  const { label, isWeak } = data as unknown as EntityData;

  return (
    <div
      className="group relative"
      style={{ minWidth: 140 }}
    >
      {/* Glow effect on select */}
      {selected && (
        <div
          className="pointer-events-none absolute -inset-1.5 rounded-xl opacity-50 blur-md"
          style={{
            background: isWeak
              ? 'linear-gradient(135deg, #f59e0b33, #f59e0b11)'
              : 'linear-gradient(135deg, #8b5cf633, #8b5cf611)',
          }}
        />
      )}

      <div
        className={`relative overflow-hidden rounded-xl border transition-all duration-200 ${
          selected
            ? isWeak
              ? 'border-amber-400/50 shadow-lg shadow-amber-500/10'
              : 'border-violet-400/50 shadow-lg shadow-violet-500/10'
            : 'border-zinc-800/60 shadow-md shadow-black/20 hover:shadow-lg hover:shadow-black/25'
        }`}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{
            background: isWeak
              ? 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)'
              : 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.06) 100%)',
          }}
        >
          {/* Colored dot */}
          <div className={`h-2 w-2 rounded-full ${isWeak ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]' : 'bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.5)]'}`} />
          <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${isWeak ? 'text-amber-400/90' : 'text-violet-400/90'}`}>
            {isWeak ? 'Weak Entity' : 'Entity'}
          </span>
        </div>

        {/* Separator line */}
        <div className={`h-px ${isWeak ? 'bg-amber-500/20' : 'bg-violet-500/20'}`} />

        {/* Body */}
        <div className="bg-[#18181b] px-4 py-3">
          <span className="text-sm font-semibold tracking-wide text-zinc-100">{label}</span>
        </div>
      </div>

      {/* Handles — small dots for edge connections */}
      <Handle type="source" position={Position.Right} className={`!h-1.5 !w-1.5 !rounded-full !border-0 ${isWeak ? '!bg-amber-400/60' : '!bg-violet-400/60'}`} />
      <Handle type="target" position={Position.Left} className={`!h-1.5 !w-1.5 !rounded-full !border-0 ${isWeak ? '!bg-amber-400/60' : '!bg-violet-400/60'}`} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={`!h-1.5 !w-1.5 !rounded-full !border-0 ${isWeak ? '!bg-amber-400/60' : '!bg-violet-400/60'}`} />
      <Handle type="target" position={Position.Top} id="top" className={`!h-1.5 !w-1.5 !rounded-full !border-0 ${isWeak ? '!bg-amber-400/60' : '!bg-violet-400/60'}`} />
    </div>
  );
});
