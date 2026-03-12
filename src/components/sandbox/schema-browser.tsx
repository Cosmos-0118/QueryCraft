'use client';

import type { TableSchema } from '@/types/database';
import { cn } from '@/lib/utils/helpers';

interface SchemaBrowserProps {
  tables: TableSchema[];
  className?: string;
}

export function SchemaBrowser({ tables, className }: SchemaBrowserProps) {
  if (tables.length === 0) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Schema
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">
          No tables yet. Execute a CREATE TABLE statement or load a sample dataset.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Schema ({tables.length} table{tables.length !== 1 ? 's' : ''})
        </h3>
      </div>
      <div className="max-h-80 overflow-y-auto p-2">
        {tables.map((table) => (
          <details key={table.name} className="group">
            <summary className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
              <span className="text-xs text-muted-foreground transition-transform group-open:rotate-90">
                ▶
              </span>
              <span className="text-primary">📋</span>
              {table.name}
            </summary>
            <ul className="ml-7 space-y-0.5 pb-1">
              {table.columns.map((col) => (
                <li
                  key={col.name}
                  className="flex items-center gap-2 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {col.primaryKey ? (
                    <span className="text-yellow-500" title="Primary Key">🔑</span>
                  ) : (
                    <span className="opacity-30">•</span>
                  )}
                  <span className="font-medium text-foreground">{col.name}</span>
                  <span className="uppercase opacity-60">{col.type}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
