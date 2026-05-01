'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AttributeKind } from '@/types/er-diagram';

interface AttributeData {
  label: string;
  kind: AttributeKind;
}

// Attribute appearances expressed entirely as CSS-variable-based inline styles
// so every theme changes them automatically.
type KindStyle = {
  gradient: string;
  borderStyle: React.CSSProperties;
  dotStyle: React.CSSProperties;
  ringStyle: React.CSSProperties;
  badgeLabel: string;
  textStyle: React.CSSProperties;
  textClass: string;
};

const kindConfig: Record<AttributeKind, KindStyle> = {
  regular: {
    gradient: 'linear-gradient(135deg, color-mix(in oklab, var(--border) 40%, transparent) 0%, color-mix(in oklab, var(--border) 14%, transparent) 100%)',
    borderStyle: { borderColor: 'var(--border)' },
    dotStyle: { backgroundColor: 'var(--muted-foreground)', opacity: 0.6 },
    ringStyle: {},
    badgeLabel: '',
    textStyle: {},
    textClass: 'text-foreground/80',
  },
  key: {
    gradient: 'linear-gradient(135deg, color-mix(in oklab, var(--warning) 22%, var(--card)) 0%, color-mix(in oklab, var(--warning) 8%, var(--card)) 100%)',
    borderStyle: { borderColor: 'color-mix(in oklab, var(--warning) 62%, transparent)' },
    dotStyle: { backgroundColor: 'var(--warning)', boxShadow: '0 0 6px color-mix(in oklab, var(--warning) 55%, transparent)' },
    ringStyle: { outline: '2px solid color-mix(in oklab, var(--warning) 44%, transparent)', outlineOffset: '2px' },
    badgeLabel: 'PK',
    textStyle: { color: 'var(--warning)' },
    textClass: 'font-semibold',
  },
  multivalued: {
    gradient: 'linear-gradient(135deg, color-mix(in oklab, var(--info) 20%, var(--card)) 0%, color-mix(in oklab, var(--info) 7%, var(--card)) 100%)',
    borderStyle: { borderColor: 'color-mix(in oklab, var(--info) 60%, transparent)' },
    dotStyle: { backgroundColor: 'var(--info)', boxShadow: '0 0 6px color-mix(in oklab, var(--info) 55%, transparent)' },
    ringStyle: { outline: '2px solid color-mix(in oklab, var(--info) 40%, transparent)', outlineOffset: '2px' },
    badgeLabel: 'MV',
    textStyle: { color: 'var(--info)' },
    textClass: '',
  },
  derived: {
    gradient: 'linear-gradient(135deg, color-mix(in oklab, var(--border) 32%, transparent) 0%, color-mix(in oklab, var(--border) 10%, transparent) 100%)',
    borderStyle: { borderColor: 'color-mix(in oklab, var(--border) 72%, transparent)', borderStyle: 'dashed' },
    dotStyle: { backgroundColor: 'var(--muted-foreground)', opacity: 0.5 },
    ringStyle: {},
    badgeLabel: 'D',
    textStyle: {},
    textClass: 'text-muted-foreground/80 italic',
  },
  composite: {
    gradient: 'linear-gradient(135deg, color-mix(in oklab, var(--success) 20%, var(--card)) 0%, color-mix(in oklab, var(--success) 7%, var(--card)) 100%)',
    borderStyle: { borderColor: 'color-mix(in oklab, var(--success) 60%, transparent)' },
    dotStyle: { backgroundColor: 'var(--success)', boxShadow: '0 0 6px color-mix(in oklab, var(--success) 52%, transparent)' },
    ringStyle: { outline: '2px solid color-mix(in oklab, var(--success) 38%, transparent)', outlineOffset: '2px' },
    badgeLabel: 'C',
    textStyle: { color: 'var(--success)' },
    textClass: '',
  },
};

export const AttributeNode = memo(function AttributeNode({ data, selected }: NodeProps) {
  const { label, kind } = data as unknown as AttributeData;
  const c = kindConfig[kind];

  return (
    <div className="group relative">
      {selected && (
        <div
          className="pointer-events-none absolute -inset-1 rounded-full blur-md"
          style={{ background: 'color-mix(in oklab, var(--primary) 14%, transparent)' }}
        />
      )}

      <div
        className={`relative flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all duration-150 ${
          selected ? 'shadow-lg' : 'shadow-sm hover:shadow-md'
        } ${c.textClass}`}
        style={{
          background: c.gradient,
          ...c.borderStyle,
          ...(selected ? c.ringStyle : {}),
        }}
      >
        {/* Colored dot indicator */}
        <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={c.dotStyle} />

        {/* Badge */}
        {c.badgeLabel && (
          <span
            className="rounded-sm px-1 py-px text-[8px] font-bold uppercase leading-none tracking-wider"
            style={{
              background: 'color-mix(in oklab, var(--muted-foreground) 14%, var(--card))',
              color: 'var(--muted-foreground)',
            }}
          >
            {c.badgeLabel}
          </span>
        )}

        {/* Label */}
        <span
          className={`text-[11px] leading-none ${c.textClass} ${kind === 'key' ? 'underline underline-offset-2' : ''}`}
          style={{
            ...c.textStyle,
            ...(kind === 'key' ? { textDecorationColor: 'color-mix(in oklab, var(--warning) 55%, transparent)' } : {}),
          }}
        >
          {label}
        </span>

        <Handle type="target" position={Position.Left} isConnectable={false} className="!h-2 !w-2 !rounded-full !border-0 !bg-transparent !opacity-0" />
        <Handle type="source" position={Position.Right} id="right" isConnectable={false} className="!h-2 !w-2 !rounded-full !border-0 !bg-transparent !opacity-0" />
      </div>
    </div>
  );
});
