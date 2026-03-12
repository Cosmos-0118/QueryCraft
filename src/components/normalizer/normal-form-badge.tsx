'use client';

import type { NormalForm } from '@/types/normalizer';
import { cn } from '@/lib/utils/helpers';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Shield,
} from 'lucide-react';

interface NormalFormBadgeProps {
  nf: NormalForm | null;
  size?: 'sm' | 'md';
  className?: string;
}

const config: Record<
  NormalForm,
  { bg: string; text: string; border: string; glow: string; icon: typeof Shield }
> = {
  UNF: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    glow: 'shadow-red-500/10',
    icon: ShieldAlert,
  },
  '1NF': {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
    glow: 'shadow-orange-500/10',
    icon: ShieldQuestion,
  },
  '2NF': {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/20',
    glow: 'shadow-yellow-500/10',
    icon: Shield,
  },
  '3NF': {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    glow: 'shadow-blue-500/10',
    icon: ShieldCheck,
  },
  BCNF: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-500/10',
    icon: ShieldCheck,
  },
  '4NF': {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/20',
    glow: 'shadow-teal-500/10',
    icon: ShieldCheck,
  },
  '5NF': {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
    glow: 'shadow-cyan-500/10',
    icon: ShieldCheck,
  },
};

export function NormalFormBadge({ nf, size = 'md', className }: NormalFormBadgeProps) {
  if (!nf) return null;

  const c = config[nf];
  const Icon = c.icon;
  const isSm = size === 'sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border font-bold shadow-sm',
        c.bg,
        c.text,
        c.border,
        c.glow,
        isSm ? 'px-1.5 py-0 text-[10px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      <Icon className={isSm ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {nf}
    </span>
  );
}
