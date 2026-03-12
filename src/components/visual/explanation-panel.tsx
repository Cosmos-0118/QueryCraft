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
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg><span className="font-medium">Hint:</span> {hint}
        </div>
      )}
    </div>
  );
}
