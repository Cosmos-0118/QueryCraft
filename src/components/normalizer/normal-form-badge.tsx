'use client';

import type { NormalForm } from '@/types/normalizer';
import { cn } from '@/lib/utils/helpers';

interface NormalFormBadgeProps {
  nf: NormalForm | null;
  className?: string;
}

const colors: Record<NormalForm, string> = {
  UNF: 'bg-red-500/20 text-red-500 border-red-500/30',
  '1NF': 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  '2NF': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  '3NF': 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  BCNF: 'bg-green-500/20 text-green-500 border-green-500/30',
  '4NF': 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
  '5NF': 'bg-teal-500/20 text-teal-500 border-teal-500/30',
};

export function NormalFormBadge({ nf, className }: NormalFormBadgeProps) {
  if (!nf) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold',
        colors[nf],
        className,
      )}
    >
      {nf}
    </span>
  );
}
