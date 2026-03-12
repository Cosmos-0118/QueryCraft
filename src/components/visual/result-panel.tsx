'use client';

import { TableViewer } from './table-viewer';
import { cn } from '@/lib/utils/helpers';

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
    <div className={cn('rounded-lg border border-border', className)}>
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Result
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{count} row{count !== 1 ? 's' : ''}</span>
          {executionTimeMs !== undefined && <span>{executionTimeMs.toFixed(1)}ms</span>}
        </div>
      </div>
      <TableViewer columns={columns} rows={rows} />
    </div>
  );
}
