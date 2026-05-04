'use client';

import { cn } from '@/lib/utils/helpers';

interface TableViewerProps {
  columns: string[];
  rows: Record<string, unknown>[];
  highlightRows?: number[];
  highlightColumns?: string[];
  className?: string;
  caption?: string;
  density?: 'comfortable' | 'compact';
  scrollMode?: 'container' | 'page';
}

export function TableViewer({
  columns,
  rows,
  highlightRows = [],
  highlightColumns = [],
  className,
  caption,
  density = 'comfortable',
  scrollMode = 'container',
}: TableViewerProps) {
  const isCompact = density === 'compact';
  const formatCellValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return String(value);
  };

  return (
    <div
      className={cn(
        'qc-sandbox-code-block rounded-lg',
        scrollMode === 'container' ? 'overflow-auto' : 'overflow-x-auto overflow-y-visible',
        className,
      )}
    >
      <table className={cn('qc-sandbox-data-grid w-full', isCompact ? 'text-xs' : 'text-sm')}>
        {caption && (
          <caption
            className={cn(
              'qc-sandbox-data-grid-caption text-left font-semibold uppercase tracking-wider text-muted-foreground',
              isCompact ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2 text-xs',
            )}
          >
            {caption}
          </caption>
        )}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className={cn(
                  'qc-sandbox-data-grid-header text-left font-semibold',
                  isCompact ? 'whitespace-nowrap px-3 py-1.5 text-[11px]' : 'px-4 py-2.5',
                )}
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
              <td
                colSpan={columns.length}
                className={cn(
                  'text-center text-muted-foreground',
                  isCompact ? 'px-3 py-6 text-xs' : 'px-4 py-8',
                )}
              >
                No data
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'qc-sandbox-data-row transition-colors',
                  highlightRows.includes(i)
                    ? 'qc-sandbox-data-row-highlight animate-[highlight-flash_0.6s_ease-out]'
                    : i % 2 === 0
                      ? 'qc-sandbox-data-row-even'
                      : 'qc-sandbox-data-row-odd',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className={cn(
                      'qc-sandbox-data-grid-cell',
                      isCompact ? 'whitespace-nowrap px-3 py-1.5 text-[11px]' : 'px-4 py-2',
                      highlightColumns.includes(col) && 'font-medium',
                    )}
                    title={String(row[col] ?? '')}
                    style={
                      highlightColumns.includes(col)
                        ? {
                          background: 'color-mix(in oklab, var(--accent) 8%, transparent)',
                        }
                        : undefined
                    }
                  >
                    {formatCellValue(row[col])}
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
