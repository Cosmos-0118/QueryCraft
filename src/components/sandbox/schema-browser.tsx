'use client';

import type { TableSchema } from '@/types/database';
import { cn } from '@/lib/utils/helpers';
import { Database, KeyRound } from 'lucide-react';

interface SchemaBrowserProps {
  tables: TableSchema[];
  className?: string;
}

export function SchemaBrowser({ tables, className }: SchemaBrowserProps) {
  if (tables.length === 0) {
    return (
      <div className={cn('rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
        <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
          <Database className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Schema
          </span>
        </div>
        <p className="px-4 py-6 text-center text-xs text-zinc-600">
          No tables yet. Load a dataset or create a table.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <Database className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Schema
        </span>
        <span className="ml-auto rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
          {tables.length}
        </span>
      </div>
      <div className="max-h-80 overflow-y-auto p-1.5">
        {tables.map((table) => (
          <details key={table.name} className="group">
            <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/50">
              <span className="text-[10px] text-zinc-600 transition-transform group-open:rotate-90">
                ▶
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
              {table.name}
              <span className="ml-auto text-[10px] text-zinc-600">{table.columns.length} cols</span>
            </summary>
            <ul className="ml-7 space-y-0.5 pb-1.5">
              {table.columns.map((col) => (
                <li
                  key={col.name}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1 text-xs text-zinc-500"
                >
                  {col.primaryKey ? (
                    <KeyRound className="h-3 w-3 text-amber-400" />
                  ) : (
                    <span className="ml-0.5 inline-block h-1 w-1 rounded-full bg-zinc-700" />
                  )}
                  <span className="font-medium text-zinc-300">{col.name}</span>
                  <span className="ml-auto font-mono text-[10px] uppercase text-zinc-600">{col.type}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
