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
    <div className={cn('qc-sandbox-code-block overflow-auto rounded-lg', className)}>
      <table className="w-full text-sm">
        {caption && (
          <caption
            className="border-b px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            style={{
              borderColor: 'var(--sandbox-border-soft)',
              background: 'color-mix(in oklab, var(--sandbox-surface-soft) 84%, transparent)',
            }}
          >
            {caption}
          </caption>
        )}
        <thead>
          <tr
            className="border-b"
            style={{
              borderColor: 'var(--sandbox-border-soft)',
              background: 'color-mix(in oklab, var(--sandbox-surface-soft) 80%, transparent)',
            }}
          >
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-2.5 text-left font-semibold"
                style={
                  highlightColumns.includes(col)
                    ? {
                      background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
                      color: 'var(--accent)',
                    }
                    : undefined
                }
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
                className={cn('border-b last:border-0 transition-colors', highlightRows.includes(i) && 'animate-[highlight-flash_0.6s_ease-out]')}
                style={{
                  borderColor: 'var(--sandbox-border-soft)',
                  background: highlightRows.includes(i)
                    ? 'color-mix(in oklab, var(--accent) 12%, transparent)'
                    : undefined,
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className={cn('px-4 py-2', highlightColumns.includes(col) && 'font-medium')}
                    style={
                      highlightColumns.includes(col)
                        ? {
                          background: 'color-mix(in oklab, var(--accent) 8%, transparent)',
                        }
                        : undefined
                    }
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
