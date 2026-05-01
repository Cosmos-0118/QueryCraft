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
          className="pointer-events-none absolute -inset-1.5 rounded-xl opacity-60 blur-md"
          style={{
            background: isWeak
              ? 'linear-gradient(135deg, color-mix(in oklab, var(--warning) 24%, transparent), color-mix(in oklab, var(--warning) 8%, transparent))'
              : 'linear-gradient(135deg, color-mix(in oklab, var(--primary) 22%, transparent), color-mix(in oklab, var(--primary) 7%, transparent))',
          }}
        />
      )}

      <div
        className={`relative overflow-hidden rounded-xl border transition-all duration-200 ${
          selected
            ? 'shadow-lg'
            : 'border-border bg-card shadow-sm hover:shadow-md'
        }`}
        style={selected ? {
          borderColor: isWeak
            ? 'color-mix(in oklab, var(--warning) 55%, var(--border))'
            : 'color-mix(in oklab, var(--primary) 55%, var(--border))',
          boxShadow: isWeak
            ? '0 8px 28px -12px color-mix(in oklab, var(--warning) 36%, transparent)'
            : '0 8px 28px -12px color-mix(in oklab, var(--primary) 32%, transparent)',
        } : undefined}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{
            background: isWeak
              ? 'linear-gradient(135deg, color-mix(in oklab, var(--warning) 16%, var(--card)) 0%, color-mix(in oklab, var(--warning) 6%, var(--card)) 100%)'
              : 'linear-gradient(135deg, color-mix(in oklab, var(--primary) 18%, var(--card)) 0%, color-mix(in oklab, var(--primary) 7%, var(--card)) 100%)',
          }}
        >
          {/* Colored dot */}
          <div
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: isWeak ? 'var(--warning)' : 'var(--primary)',
              boxShadow: isWeak
                ? '0 0 6px color-mix(in oklab, var(--warning) 55%, transparent)'
                : '0 0 6px color-mix(in oklab, var(--primary) 50%, transparent)',
            }}
          />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ color: isWeak ? 'var(--warning)' : 'var(--primary)', opacity: 0.9 }}
          >
            {isWeak ? 'Weak Entity' : 'Entity'}
          </span>
        </div>

        {/* Separator line */}
        <div
          className="h-px"
          style={{ background: isWeak ? 'color-mix(in oklab, var(--warning) 22%, transparent)' : 'color-mix(in oklab, var(--primary) 22%, transparent)' }}
        />

        {/* Body */}
        <div className="bg-card px-4 py-3">
          <span className="text-sm font-semibold tracking-wide text-foreground">{label}</span>
        </div>
      </div>

      {/* Handles — invisible, only for React Flow edge routing */}
      <Handle type="source" position={Position.Right} isConnectable={false} className="!h-2 !w-2 !rounded-full !border-0 !bg-transparent !opacity-0" />
      <Handle type="target" position={Position.Left} isConnectable={false} className="!h-2 !w-2 !rounded-full !border-0 !bg-transparent !opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={false} className="!h-2 !w-2 !rounded-full !border-0 !bg-transparent !opacity-0" />
      <Handle type="target" position={Position.Top} id="top" isConnectable={false} className="!h-2 !w-2 !rounded-full !border-0 !bg-transparent !opacity-0" />
    </div>
  );
});
