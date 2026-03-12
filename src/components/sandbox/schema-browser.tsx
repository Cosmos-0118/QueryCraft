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
              <span className="text-primary"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg></span>
              {table.name}
            </summary>
            <ul className="ml-7 space-y-0.5 pb-1">
              {table.columns.map((col) => (
                <li
                  key={col.name}
                  className="flex items-center gap-2 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {col.primaryKey ? (
                    <span className="text-yellow-500" title="Primary Key"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg></span>
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
