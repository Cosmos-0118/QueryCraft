'use client';

import { cn } from '@/lib/utils/helpers';

interface AlgebraToSqlProps {
  sql: string;
  className?: string;
}

export function AlgebraToSql({ sql, className }: AlgebraToSqlProps) {
  if (!sql) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
        <p className="text-sm text-muted-foreground">SQL equivalent will appear here after evaluation.</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      <div className="border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Equivalent SQL
        </span>
      </div>
      <pre className="overflow-auto p-4 font-mono text-sm text-foreground">{sql}</pre>
    </div>
  );
}
