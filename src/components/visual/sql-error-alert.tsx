'use client';

import { AlertTriangle, Compass, MapPin, TerminalSquare } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';
import type { SqlErrorDetails } from '@/types/sql-error';

interface SqlErrorAlertProps {
  error: string;
  details?: SqlErrorDetails;
  compact?: boolean;
  className?: string;
}

export function SqlErrorAlert({ error, details, compact = false, className }: SqlErrorAlertProps) {
  const title = details?.title ?? 'SQL execution error';
  const message = details?.message ?? error;
  const hint = details?.hint;
  const rawMessage = details?.rawMessage ?? error;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-rose-500/30 bg-[linear-gradient(145deg,rgba(127,29,29,0.26),rgba(24,24,27,0.92))] p-4 text-rose-100 shadow-[0_22px_48px_-34px_rgba(244,63,94,0.55)]',
        compact && 'p-3',
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute -right-9 -top-9 h-28 w-28 rounded-full bg-rose-400/10 blur-2xl" />

      <div className="relative flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-300/35 bg-rose-500/15 text-rose-200">
          <AlertTriangle className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-tight text-rose-100">{title}</p>
            {details?.code && (
              <span className="rounded-md border border-rose-300/30 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-200">
                {details.code}
              </span>
            )}
            {details?.category && (
              <span className="rounded-md border border-rose-300/25 bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-100/90">
                {details.category.replace(/-/g, ' ')}
              </span>
            )}
          </div>

          <p className="text-sm leading-relaxed text-rose-100/90">{message}</p>

          {hint && (
            <div className="inline-flex items-start gap-1.5 rounded-lg border border-teal-300/20 bg-teal-500/10 px-2.5 py-1.5 text-[12px] text-teal-100/95">
              <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{hint}</span>
            </div>
          )}

          {(details?.location || rawMessage) && (
            <div className="grid gap-1.5 text-[11px] text-rose-100/75">
              {details?.location && (
                <div className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  <span>
                    line {details.location.line}, col {details.location.column}
                  </span>
                </div>
              )}

              <div className="inline-flex items-start gap-1.5">
                <TerminalSquare className="mt-[2px] h-3 w-3 shrink-0" />
                <span className="font-mono break-all text-rose-100/70">{rawMessage}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
