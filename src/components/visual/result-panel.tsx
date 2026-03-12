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
    <div className={cn('rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      <div className="flex items-center justify-between border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Table2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Result
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span>{count} row{count !== 1 ? 's' : ''}</span>
          {executionTimeMs !== undefined && (
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
              {executionTimeMs.toFixed(1)}ms
            </span>
          )}
        </div>
      </div>
      <TableViewer columns={columns} rows={rows} />
    </div>
  );
}
