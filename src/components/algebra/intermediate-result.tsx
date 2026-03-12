'use client';

import type { StepResult } from '@/lib/engine/algebra-evaluator';
import { TableViewer } from '@/components/visual/table-viewer';
import { cn } from '@/lib/utils/helpers';

interface IntermediateResultProps {
  steps: StepResult[];
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

export function IntermediateResult({ steps, activeIndex, onSelect, className }: IntermediateResultProps) {
  if (steps.length === 0) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
        <p className="text-sm text-muted-foreground">Evaluate an expression to see intermediate results.</p>
      </div>
    );
  }

  const active = steps[activeIndex] ?? steps[steps.length - 1];

  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      <div className="border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Step-by-Step Results
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={cn(
              'shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors',
              i === activeIndex
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {i + 1}. {step.node.label.length > 12 ? step.node.label.slice(0, 11) + '…' : step.node.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2 text-sm">
          <span className="font-semibold text-primary">{active.node.label}</span>
          <span className="text-xs text-muted-foreground">
            — {active.result.rows.length} row{active.result.rows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <TableViewer
          columns={active.result.columns}
          rows={active.result.rows}
        />
      </div>
    </div>
  );
}
