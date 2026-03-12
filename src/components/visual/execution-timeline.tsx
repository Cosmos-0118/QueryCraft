'use client';

import { cn } from '@/lib/utils/helpers';

interface TimelineStep {
  label: string;
  description?: string;
}

interface ExecutionTimelineProps {
  steps: TimelineStep[];
  currentStep: number;
  onStepClick: (index: number) => void;
  className?: string;
}

export function ExecutionTimeline({
  steps,
  currentStep,
  onStepClick,
  className,
}: ExecutionTimelineProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className="flex items-center gap-0 py-2" style={{ minWidth: steps.length * 120 }}>
        {steps.map((step, i) => {
          const isActive = i === currentStep;
          const isCompleted = i < currentStep;

          return (
            <div key={i} className="flex items-center">
              <button
                onClick={() => onStepClick(i)}
                className="flex flex-col items-center"
                title={step.description}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all',
                    isActive && 'bg-primary text-primary-foreground shadow-lg scale-110',
                    isCompleted && 'bg-primary/20 text-primary',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                  )}
                >
                  {isCompleted ? '✓' : i + 1}
                </div>
                <span
                  className={cn(
                    'mt-1.5 max-w-[100px] text-center text-xs leading-tight',
                    isActive ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-0.5 w-8 transition-colors',
                    i < currentStep ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
