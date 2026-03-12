'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AttributeKind } from '@/types/er-diagram';

interface AttributeData {
  label: string;
  kind: AttributeKind;
}

const kindConfig: Record<AttributeKind, {
  gradient: string;
  border: string;
  dot: string;
  glow: string;
  badgeLabel: string;
  textClass: string;
}> = {
  regular: {
    gradient: 'linear-gradient(135deg, rgba(113,113,122,0.08) 0%, rgba(113,113,122,0.02) 100%)',
    border: 'border-zinc-700/60',
    dot: 'bg-zinc-500',
    glow: '',
    badgeLabel: '',
    textClass: 'text-zinc-300',
  },
  key: {
    gradient: 'linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(234,179,8,0.03) 100%)',
    border: 'border-yellow-500/40',
    dot: 'bg-yellow-400 shadow-[0_0_6px_rgba(234,179,8,0.6)]',
    glow: 'shadow-yellow-500/5',
    badgeLabel: 'PK',
    textClass: 'text-yellow-200 font-semibold',
  },
  multivalued: {
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.03) 100%)',
    border: 'border-blue-500/40',
    dot: 'bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.6)]',
    glow: 'shadow-blue-500/5',
    badgeLabel: 'MV',
    textClass: 'text-blue-200',
  },
  derived: {
    gradient: 'linear-gradient(135deg, rgba(113,113,122,0.06) 0%, rgba(113,113,122,0.02) 100%)',
    border: 'border-dashed border-zinc-600/60',
    dot: 'bg-zinc-500',
    glow: '',
    badgeLabel: 'D',
    textClass: 'text-zinc-400 italic',
  },
  composite: {
    gradient: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.03) 100%)',
    border: 'border-green-500/40',
    dot: 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.6)]',
    glow: 'shadow-green-500/5',
    badgeLabel: 'C',
    textClass: 'text-green-200',
  },
};

export const AttributeNode = memo(function AttributeNode({ data, selected }: NodeProps) {
  const { label, kind } = data as unknown as AttributeData;
  const c = kindConfig[kind];

  return (
    <div className="group relative">
      {selected && (
        <div className="pointer-events-none absolute -inset-1 rounded-full bg-violet-500/10 blur-md" />
      )}

      <div
        className={`relative flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all duration-150 ${c.border} ${c.glow} ${
          selected ? 'ring-2 ring-violet-400/50 shadow-lg' : 'shadow-sm shadow-black/15 hover:shadow-md'
        }`}
        style={{ background: c.gradient }}
      >
        {/* Colored dot indicator */}
        <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />

        {/* Badge */}
        {c.badgeLabel && (
          <span className="rounded-sm bg-white/[0.06] px-1 py-px text-[8px] font-bold uppercase leading-none tracking-wider text-zinc-400">
            {c.badgeLabel}
          </span>
        )}

        {/* Label */}
        <span className={`text-[11px] leading-none ${c.textClass} ${kind === 'key' ? 'underline decoration-yellow-500/60 underline-offset-2' : ''}`}>
          {label}
        </span>

        <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !rounded-full !border-0 !bg-zinc-500" />
        <Handle type="source" position={Position.Right} id="right" className="!h-1.5 !w-1.5 !rounded-full !border-0 !bg-zinc-500" />
      </div>
    </div>
  );
});
