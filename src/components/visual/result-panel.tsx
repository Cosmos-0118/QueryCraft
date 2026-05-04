'use client';

import { TableViewer } from './table-viewer';
import { cn } from '@/lib/utils/helpers';
import { Table2 } from 'lucide-react';

interface ResultPanelProps {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount?: number;
  executionTimeMs?: number;
  className?: string;
  compact?: boolean;
  scrollMode?: 'container' | 'page';
}

export function ResultPanel({
  columns,
  rows,
  rowCount,
  executionTimeMs,
  className,
  compact = false,
  scrollMode = 'container',
}: ResultPanelProps) {
  const count = rowCount ?? rows.length;

  return (
    <div className={cn('qc-sandbox-surface-soft rounded-xl', className)}>
      <div
        className={cn('flex items-center justify-between border-b', compact ? 'px-3 py-2' : 'px-4 py-2.5')}
        style={{
          borderColor: 'var(--sandbox-border-soft)',
          background: 'color-mix(in oklab, var(--sandbox-surface-soft) 86%, transparent)',
        }}
      >
        <div className="flex items-center gap-2">
          <Table2 className="h-3.5 w-3.5 text-[color:var(--sandbox-tone-emerald)]" />
          <span className={cn('font-semibold uppercase tracking-wider text-muted-foreground/80', compact ? 'text-[11px]' : 'text-xs')}>
            Result
          </span>
        </div>
        <div className={cn('flex items-center text-muted-foreground/80', compact ? 'gap-2.5 text-[10px]' : 'gap-3 text-[11px]')}>
          <span>{count} row{count !== 1 ? 's' : ''}</span>
          {executionTimeMs !== undefined && (
            <span data-tone="emerald" className="qc-sandbox-dialog-badge rounded-md px-1.5 py-0.5 text-[10px] font-bold">
              {executionTimeMs.toFixed(1)}ms
            </span>
          )}
        </div>
      </div>
      <TableViewer
        columns={columns}
        rows={rows}
        density={compact ? 'compact' : 'comfortable'}
        scrollMode={scrollMode}
      />
    </div>
  );
}
