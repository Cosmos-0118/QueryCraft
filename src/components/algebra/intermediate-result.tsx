'use client';

import type { StepResult } from '@/lib/engine/algebra-evaluator';
import { TableViewer } from '@/components/visual/table-viewer';
import { cn } from '@/lib/utils/helpers';
import { Layers } from 'lucide-react';

interface IntermediateResultProps {
  steps: StepResult[];
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

export function IntermediateResult({ steps, activeIndex, onSelect, className }: IntermediateResultProps) {
  if (steps.length === 0) return null;

  const active = steps[activeIndex] ?? steps[steps.length - 1];

  return (
    <div className={cn('overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <Layers className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Step-by-Step Results
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-b border-zinc-700/40 px-4 py-2">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              i === activeIndex
                ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300',
            )}
          >
            {i + 1}. {step.node.label.length > 14 ? step.node.label.slice(0, 13) + '…' : step.node.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="font-semibold text-violet-300">{active.node.label}</span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
            {active.result.rows.length} row{active.result.rows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <TableViewer columns={active.result.columns} rows={active.result.rows} />
      </div>
    </div>
  );
}
