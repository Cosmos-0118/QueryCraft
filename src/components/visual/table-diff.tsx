'use client';

import { cn } from '@/lib/utils/helpers';

type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

interface TableDiffProps {
  columns: string[];
  beforeRows: Record<string, unknown>[];
  afterRows: Record<string, unknown>[];
  rowDiffs: DiffType[];
  className?: string;
}

const DIFF_STYLES: Record<DiffType, string> = {
  added: 'bg-green-500/10 border-l-2 border-l-green-500',
  removed: 'bg-red-500/10 border-l-2 border-l-red-500 line-through opacity-70',
  modified: 'bg-yellow-500/10 border-l-2 border-l-yellow-500',
  unchanged: '',
};

export function TableDiff({ columns, beforeRows, afterRows, rowDiffs, className }: TableDiffProps) {
  const rows = afterRows.length > 0 ? afterRows : beforeRows;

  return (
    <div className={cn('overflow-auto rounded-lg border border-border', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="w-8 px-2 py-2.5 text-center text-muted-foreground">#</th>
            {columns.map((col) => (
              <th key={col} className="px-4 py-2.5 text-left font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                'border-b border-border last:border-0 transition-all',
                DIFF_STYLES[rowDiffs[i] || 'unchanged'],
              )}
            >
              <td className="px-2 py-2 text-center text-xs text-muted-foreground">{i + 1}</td>
              {columns.map((col) => (
                <td key={col} className="px-4 py-2">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Added
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Removed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Modified
        </span>
      </div>
    </div>
  );
}
