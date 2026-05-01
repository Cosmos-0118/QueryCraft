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
}

export function ResultPanel({
  columns,
  rows,
  rowCount,
  executionTimeMs,
  className,
}: ResultPanelProps) {
  const count = rowCount ?? rows.length;

  return (
    <div className={cn('qc-sandbox-surface-soft rounded-xl', className)}>
      <div
        className="flex items-center justify-between border-b px-4 py-2.5"
        style={{
          borderColor: 'var(--sandbox-border-soft)',
          background: 'color-mix(in oklab, var(--sandbox-surface-soft) 86%, transparent)',
        }}
      >
        <div className="flex items-center gap-2">
          <Table2 className="h-3.5 w-3.5 text-[color:var(--sandbox-tone-emerald)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            Result
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80">
          <span>{count} row{count !== 1 ? 's' : ''}</span>
          {executionTimeMs !== undefined && (
            <span data-tone="emerald" className="qc-sandbox-dialog-badge rounded-md px-1.5 py-0.5 text-[10px] font-bold">
              {executionTimeMs.toFixed(1)}ms
            </span>
          )}
        </div>
      </div>
      <TableViewer columns={columns} rows={rows} />
    </div>
  );
}
