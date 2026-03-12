'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/helpers';
import { Code2, Copy, Check } from 'lucide-react';

interface AlgebraToSqlProps {
  sql: string;
  className?: string;
}

export function AlgebraToSql({ sql, className }: AlgebraToSqlProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!sql) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-8',
          className,
        )}
      >
        <p className="text-sm text-zinc-600">SQL equivalent appears after evaluation</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      <div className="flex items-center justify-between border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Equivalent SQL
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-auto p-4 font-mono text-sm leading-relaxed text-emerald-300/90">
        {sql}
      </pre>
    </div>
  );
}
