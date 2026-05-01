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
        'relative overflow-hidden rounded-xl border p-4 shadow-[0_22px_48px_-34px_rgba(15,23,42,0.45)]',
        compact && 'p-3',
        className,
      )}
      style={{
        borderColor: 'var(--sandbox-error-border)',
        color: 'var(--sandbox-error-fg)',
        background:
          'linear-gradient(145deg, color-mix(in oklab, var(--sandbox-error-bg) 82%, transparent), color-mix(in oklab, var(--sandbox-surface-strong) 90%, transparent))',
      }}
      role="alert"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute -right-9 -top-9 h-28 w-28 rounded-full blur-2xl"
        style={{ background: 'color-mix(in oklab, var(--sandbox-error-border) 30%, transparent)' }}
      />

      <div className="relative flex items-start gap-3">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: 'color-mix(in oklab, var(--sandbox-error-border) 80%, transparent)',
            background: 'color-mix(in oklab, var(--sandbox-error-bg) 80%, transparent)',
            color: 'var(--sandbox-error-fg)',
          }}
        >
          <AlertTriangle className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-tight" style={{ color: 'var(--sandbox-error-fg)' }}>{title}</p>
            {details?.code && (
              <span
                className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                style={{
                  borderColor: 'color-mix(in oklab, var(--sandbox-error-border) 78%, transparent)',
                  background: 'color-mix(in oklab, var(--sandbox-error-bg) 74%, transparent)',
                  color: 'var(--sandbox-error-fg)',
                }}
              >
                {details.code}
              </span>
            )}
            {details?.category && (
              <span
                className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  borderColor: 'color-mix(in oklab, var(--sandbox-error-border) 64%, transparent)',
                  background: 'color-mix(in oklab, var(--sandbox-surface-soft) 82%, transparent)',
                  color: 'color-mix(in oklab, var(--sandbox-error-fg) 92%, var(--foreground))',
                }}
              >
                {details.category.replace(/-/g, ' ')}
              </span>
            )}
          </div>

          <p className="text-sm leading-relaxed" style={{ color: 'color-mix(in oklab, var(--sandbox-error-fg) 94%, var(--foreground))' }}>{message}</p>

          {hint && (
            <div
              className="inline-flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px]"
              style={{
                borderColor: 'color-mix(in oklab, var(--sandbox-tone-cyan) 42%, transparent)',
                background: 'color-mix(in oklab, var(--sandbox-tone-cyan) 12%, transparent)',
                color: 'color-mix(in oklab, var(--sandbox-tone-cyan) 78%, var(--foreground))',
              }}
            >
              <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{hint}</span>
            </div>
          )}

          {(details?.location || rawMessage) && (
            <div className="grid gap-1.5 text-[11px]" style={{ color: 'color-mix(in oklab, var(--sandbox-error-fg) 74%, var(--foreground))' }}>
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
                <span className="font-mono break-all" style={{ color: 'color-mix(in oklab, var(--sandbox-error-fg) 72%, var(--foreground))' }}>{rawMessage}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
