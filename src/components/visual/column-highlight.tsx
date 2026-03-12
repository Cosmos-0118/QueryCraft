'use client';

import { cn } from '@/lib/utils/helpers';

interface ColumnHighlightProps {
  columns: string[];
  rows: Record<string, unknown>[];
  activeColumns: string[];
  label?: string;
  className?: string;
}

export function ColumnHighlight({
  columns,
  rows,
  activeColumns,
  label,
  className,
}: ColumnHighlightProps) {
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
            {columns.map((col) => {
              const isActive = activeColumns.includes(col);
              return (
                <th
                  key={col}
                  className={cn(
                    'px-4 py-2 text-left font-semibold transition-colors',
                    isActive ? 'bg-accent/20 text-accent' : 'text-muted-foreground opacity-50',
                  )}
                >
                  {col}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {columns.map((col) => {
                const isActive = activeColumns.includes(col);
                return (
                  <td
                    key={col}
                    className={cn(
                      'px-4 py-2 transition-colors',
                      isActive ? 'bg-accent/10 font-medium' : 'opacity-40',
                    )}
                  >
                    {String(row[col] ?? '')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
