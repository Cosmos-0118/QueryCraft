'use client';

import type { DecompositionStep } from '@/types/normalizer';
import { NormalFormBadge } from './normal-form-badge';
import { cn } from '@/lib/utils/helpers';
import { SplitSquareHorizontal, KeyRound, ArrowRight, CheckCircle2 } from 'lucide-react';

interface DecompositionStepperProps {
  steps: DecompositionStep[];
  activeStep: number;
  onStepSelect: (step: number) => void;
  className?: string;
}

export function DecompositionStepper({
  steps,
  activeStep,
  onStepSelect,
  className,
}: DecompositionStepperProps) {
  if (steps.length === 0) return null;

  const active = steps[activeStep];

  return (
    <div className={cn('rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <SplitSquareHorizontal className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Decomposition Steps
        </span>
        <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
          {steps.length}
        </span>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-700/40 px-4 py-2">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => onStepSelect(i)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all duration-150',
              i === activeStep
                ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25'
                : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
                i === activeStep
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-zinc-800/50 text-zinc-600',
              )}
            >
              {i + 1}
            </span>
            Step {i + 1}
            <NormalFormBadge nf={step.normalForm} size="sm" />
          </button>
        ))}
      </div>

      {active && (
        <div className="space-y-4 p-4">
          {/* Explanation */}
          <p className="text-sm leading-relaxed text-zinc-300">{active.explanation}</p>

          {/* Anomaly fixed callout */}
          {active.anomalyFixed && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="text-xs text-emerald-400">{active.anomalyFixed}</span>
            </div>
          )}

          {/* Resulting tables */}
          <div className="space-y-3">
            {active.tables.map((table) => (
              <div
                key={table.name}
                className="rounded-lg border border-zinc-800/50 bg-zinc-800/20 p-3"
              >
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-200">{table.name}</span>
                  <span className="text-[10px] text-zinc-600">
                    ({table.columns.length} col{table.columns.length !== 1 ? 's' : ''})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {table.columns.map((col) => {
                    const isPK = table.primaryKey.includes(col);
                    return (
                      <span
                        key={col}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px]',
                          isPK
                            ? 'border border-amber-500/25 bg-amber-500/10 font-bold text-amber-400'
                            : 'border border-zinc-700/40 bg-zinc-800/50 text-zinc-400',
                        )}
                      >
                        {isPK && <KeyRound className="h-2.5 w-2.5" />}
                        {col}
                      </span>
                    );
                  })}
                </div>
                {table.functionalDependencies.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-600">
                    <span className="font-medium uppercase tracking-wider">FDs:</span>
                    {table.functionalDependencies.map((fd, fi) => (
                      <span key={fi} className="inline-flex items-center gap-1 font-mono">
                        <span className="text-amber-400/70">{fd.determinant.join(', ')}</span>
                        <ArrowRight className="h-2.5 w-2.5 text-zinc-700" />
                        <span className="text-zinc-400">{fd.dependent.join(', ')}</span>
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
