'use client';

import type { TableSchema } from '@/types/database';
import { cn } from '@/lib/utils/helpers';
import { Database, KeyRound } from 'lucide-react';

interface SchemaBrowserProps {
  tables: TableSchema[];
  className?: string;
}

export function SchemaBrowser({ tables, className }: SchemaBrowserProps) {
  const containerClass = cn('qc-sandbox-surface-soft rounded-xl', className);

  if (tables.length === 0) {
    return (
      <div className={containerClass}>
        <div
          className="flex items-center gap-2 border-b px-4 py-2.5"
          style={{
            borderColor: 'var(--sandbox-border-soft)',
            background: 'color-mix(in oklab, var(--sandbox-surface-soft) 86%, transparent)',
          }}
        >
          <Database className="h-3.5 w-3.5 text-[color:var(--sandbox-tone-emerald)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
            Schema
          </span>
        </div>
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          No tables yet. Load a dataset or create a table.
        </p>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{
          borderColor: 'var(--sandbox-border-soft)',
          background: 'color-mix(in oklab, var(--sandbox-surface-soft) 86%, transparent)',
        }}
      >
        <Database className="h-3.5 w-3.5 text-[color:var(--sandbox-tone-emerald)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
          Schema
        </span>
        <span
          data-tone="emerald"
          className="qc-sandbox-dialog-badge ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold"
        >
          {tables.length}
        </span>
      </div>
      <div className="max-h-80 overflow-y-auto p-1.5">
        {tables.map((table) => (
          <details key={table.name} className="group">
            <summary
              className="qc-sandbox-list-item flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
            >
              <span className="text-[10px] text-muted-foreground transition-transform group-open:rotate-90">
                ▶
              </span>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: 'color-mix(in oklab, var(--sandbox-tone-emerald) 70%, transparent)' }}
              />
              {table.name}
              <span className="ml-auto text-[10px] text-muted-foreground">
                {table.columns.length} cols
              </span>
            </summary>
            <ul className="ml-7 space-y-0.5 pb-1.5">
              {table.columns.map((col) => (
                <li
                  key={col.name}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {col.primaryKey ? (
                    <KeyRound className="h-3 w-3 text-[color:var(--sandbox-tone-amber)]" />
                  ) : col.foreignKey ? (
                    <KeyRound className="h-3 w-3 text-[color:var(--sandbox-tone-sky)]" />
                  ) : (
                    <span
                      className="ml-0.5 inline-block h-1 w-1 rounded-full"
                      style={{ background: 'var(--sandbox-border-strong)' }}
                    />
                  )}
                  <span className="font-medium text-foreground/90">
                    {col.name}
                    {col.foreignKey && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        → {col.foreignKey.table}.{col.foreignKey.column}
                      </span>
                    )}
                  </span>
                  <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">
                    {col.type}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
