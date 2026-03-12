'use client';

import { cn } from '@/lib/utils/helpers';

interface TableViewerProps {
  columns: string[];
  rows: Record<string, unknown>[];
  highlightRows?: number[];
  highlightColumns?: string[];
  className?: string;
  caption?: string;
}

export function TableViewer({
  columns,
  rows,
  highlightRows = [],
  highlightColumns = [],
  className,
  caption,
}: TableViewerProps) {
  return (
    <div className={cn('overflow-auto rounded-lg border border-border', className)}>
      <table className="w-full text-sm">
        {caption && (
          <caption className="border-b border-border bg-muted px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {caption}
          </caption>
        )}
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {columns.map((col) => (
              <th
                key={col}
                className={cn(
                  'px-4 py-2.5 text-left font-semibold',
                  highlightColumns.includes(col) && 'bg-primary/15 text-primary',
                )}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                No data
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'border-b border-border last:border-0 transition-colors',
                  highlightRows.includes(i) && 'bg-primary/10 animate-[highlight-flash_0.6s_ease-out]',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className={cn(
                      'px-4 py-2',
                      highlightColumns.includes(col) && 'bg-primary/5 font-medium',
                    )}
                  >
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
