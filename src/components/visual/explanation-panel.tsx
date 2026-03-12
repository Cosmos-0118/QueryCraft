'use client';

import { cn } from '@/lib/utils/helpers';

interface ExplanationPanelProps {
  title: string;
  explanation: string;
  hint?: string;
  className?: string;
}

export function ExplanationPanel({ title, explanation, hint, className }: ExplanationPanelProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-5', className)}>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{explanation}</p>
      {hint && (
        <div className="mt-3 rounded-md bg-accent/10 px-3 py-2 text-xs text-accent">
          💡 <span className="font-medium">Hint:</span> {hint}
        </div>
      )}
    </div>
  );
}
