'use client';

import { cn } from '@/lib/utils/helpers';

interface RowHighlightProps {
  columns: string[];
  rows: Record<string, unknown>[];
  activeRows: number[];
  label?: string;
  className?: string;
}

export function RowHighlight({ columns, rows, activeRows, label, className }: RowHighlightProps) {
  return (
    <div className={cn('overflow-auto rounded-lg border border-border', className)}>
      {label && (
        <div className="border-b border-border bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {columns.map((col) => (
              <th key={col} className="px-4 py-2 text-left font-semibold">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isActive = activeRows.includes(i);
            return (
              <tr
                key={i}
                className={cn(
                  'border-b border-border last:border-0 transition-all duration-300',
                  isActive
                    ? 'bg-primary/15 shadow-[inset_3px_0_0_var(--primary)]'
                    : 'opacity-50',
                )}
              >
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2">{String(row[col] ?? '')}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
