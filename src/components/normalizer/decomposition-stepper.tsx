'use client';

import type { DecompositionStep } from '@/types/normalizer';
import { NormalFormBadge } from './normal-form-badge';
import { cn } from '@/lib/utils/helpers';

interface DecompositionStepperProps {
  steps: DecompositionStep[];
  activeStep: number;
  onStepSelect: (step: number) => void;
  className?: string;
}

export function DecompositionStepper({ steps, activeStep, onStepSelect, className }: DecompositionStepperProps) {
  if (steps.length === 0) return null;

  const active = steps[activeStep];

  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      <div className="border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Decomposition Steps
        </span>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => onStepSelect(i)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              i === activeStep
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            Step {i + 1}
            <NormalFormBadge nf={step.normalForm} className="text-[10px] px-1.5 py-0" />
          </button>
        ))}
      </div>

      {active && (
        <div className="p-4 space-y-3">
          <p className="text-sm">{active.explanation}</p>
          {active.anomalyFixed && (
            <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-600">
              {active.anomalyFixed}
            </div>
          )}

          <div className="space-y-3">
            {active.tables.map((table) => (
              <div key={table.name} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-sm">{table.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({table.columns.join(', ')})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {table.columns.map((col) => (
                    <span
                      key={col}
                      className={cn(
                        'rounded px-2 py-0.5 text-xs font-mono',
                        table.primaryKey.includes(col)
                          ? 'bg-yellow-500/20 text-yellow-600 font-bold border border-yellow-500/30'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {table.primaryKey.includes(col) ? '🔑 ' : ''}{col}
                    </span>
                  ))}
                </div>
                {table.functionalDependencies.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    FDs: {table.functionalDependencies.map((fd, i) => (
                      <span key={i} className="font-mono">
                        {i > 0 ? ', ' : ''}{fd.determinant.join(',')} → {fd.dependent.join(',')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
