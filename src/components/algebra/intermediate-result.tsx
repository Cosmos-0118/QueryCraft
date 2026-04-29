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
    <div className={cn('overflow-hidden rounded-xl border border-border/80/50 bg-muted/60', className)}>
      <div className="flex items-center gap-2 border-b border-border/80/40 bg-muted/80/30 px-4 py-2.5">
        <Layers className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
          Step-by-Step Results
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-b border-border/80/40 px-4 py-2">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              i === activeIndex
                ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30'
                : 'text-muted-foreground/80 hover:bg-muted/80 hover:text-foreground/80',
            )}
          >
            {i + 1}. {step.node.label.length > 14 ? step.node.label.slice(0, 13) + '…' : step.node.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="font-semibold text-violet-300">{active.node.label}</span>
          <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground/80">
            {active.result.rows.length} row{active.result.rows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <TableViewer columns={active.result.columns} rows={active.result.rows} />
      </div>
    </div>
  );
}
