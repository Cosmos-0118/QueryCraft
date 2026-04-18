'use client';

import type { TableSchema } from '@/types/database';
import { cn } from '@/lib/utils/helpers';
import { useThemeStore } from '@/stores/theme-store';
import { Database, KeyRound } from 'lucide-react';

interface SchemaBrowserProps {
  tables: TableSchema[];
  className?: string;
}

export function SchemaBrowser({ tables, className }: SchemaBrowserProps) {
  const { theme } = useThemeStore();
  const isLightTheme = theme === 'light';
  const containerClass = cn(
    'rounded-xl',
    isLightTheme
      ? 'border border-slate-200 bg-white shadow-sm'
      : 'border border-zinc-700/50 bg-zinc-900/60',
    className,
  );
  const headerClass = isLightTheme
    ? 'flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5'
    : 'flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5';
  const headerIconClass = isLightTheme ? 'h-3.5 w-3.5 text-slate-700' : 'h-3.5 w-3.5 text-emerald-400';
  const headerTitleClass = isLightTheme
    ? 'text-xs font-semibold uppercase tracking-wider text-slate-500'
    : 'text-xs font-semibold uppercase tracking-wider text-zinc-500';

  if (tables.length === 0) {
    return (
      <div className={containerClass}>
        <div className={headerClass}>
          <Database className={headerIconClass} />
          <span className={headerTitleClass}>
            Schema
          </span>
        </div>
        <p className={cn('px-4 py-6 text-center text-xs', isLightTheme ? 'text-slate-500' : 'text-zinc-600')}>
          No tables yet. Load a dataset or create a table.
        </p>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className={headerClass}>
        <Database className={headerIconClass} />
        <span className={headerTitleClass}>
          Schema
        </span>
        <span
          className={cn(
            'ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold',
            isLightTheme ? 'bg-slate-700 text-white' : 'bg-emerald-500/10 text-emerald-400',
          )}
        >
          {tables.length}
        </span>
      </div>
      <div className="max-h-80 overflow-y-auto p-1.5">
        {tables.map((table) => (
          <details key={table.name} className="group">
            <summary
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                isLightTheme ? 'text-slate-700 hover:bg-slate-100' : 'text-zinc-300 hover:bg-zinc-800/50',
              )}
            >
              <span
                className={cn(
                  'text-[10px] transition-transform group-open:rotate-90',
                  isLightTheme ? 'text-slate-500' : 'text-zinc-600',
                )}
              >
                ▶
              </span>
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isLightTheme ? 'bg-slate-500/70' : 'bg-emerald-400/60',
                )}
              />
              {table.name}
              <span className={cn('ml-auto text-[10px]', isLightTheme ? 'text-slate-500' : 'text-zinc-600')}>
                {table.columns.length} cols
              </span>
            </summary>
            <ul className="ml-7 space-y-0.5 pb-1.5">
              {table.columns.map((col) => (
                <li
                  key={col.name}
                  className={cn('flex items-center gap-2 rounded-md px-2.5 py-1 text-xs', isLightTheme ? 'text-slate-500' : 'text-zinc-500')}
                >
                  {col.primaryKey ? (
                    <KeyRound className={cn('h-3 w-3', isLightTheme ? 'text-amber-600' : 'text-amber-400')} />
                  ) : col.foreignKey ? (
                    <KeyRound className={cn('h-3 w-3', isLightTheme ? 'text-blue-600' : 'text-blue-400')} />
                  ) : (
                    <span
                      className={cn(
                        'ml-0.5 inline-block h-1 w-1 rounded-full',
                        isLightTheme ? 'bg-slate-300' : 'bg-zinc-700',
                      )}
                    />
                  )}
                  <span className={cn('font-medium', isLightTheme ? 'text-slate-700' : 'text-zinc-300')}>
                    {col.name}
                    {col.foreignKey && (
                      <span className={cn('ml-1.5 font-normal', isLightTheme ? 'text-slate-500' : 'text-zinc-500')}>
                        → {col.foreignKey.table}.{col.foreignKey.column}
                      </span>
                    )}
                  </span>
                  <span className={cn('ml-auto font-mono text-[10px] uppercase', isLightTheme ? 'text-slate-500' : 'text-zinc-600')}>
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
