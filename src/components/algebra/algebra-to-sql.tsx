'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils/helpers';
import { Code2, Copy, Check } from 'lucide-react';

// ── Compact SQL formatter ──────────────────────────────────
function formatSQL(raw: string): string {
  const sql = raw.replace(/\s+/g, ' ').trim();

  // If short enough, just return as-is
  if (sql.length <= 60) return sql;

  // Only break before top-level clause keywords (not inside parentheses)
  const CLAUSE_KW = /\b(SELECT|FROM|WHERE|ORDER BY|GROUP BY|HAVING|LIMIT|UNION|INTERSECT|EXCEPT)\b/gi;

  let depth = 0;
  let result = '';
  let i = 0;

  while (i < sql.length) {
    if (sql[i] === '(') {
      depth++;
      result += '(';
      i++;
    } else if (sql[i] === ')') {
      depth--;
      result += ')';
      i++;
    } else if (depth === 0) {
      // Check for clause keyword at current position
      const rest = sql.slice(i);
      const match = rest.match(CLAUSE_KW);
      if (match && rest.indexOf(match[0]) === 0 && i > 0) {
        result += '\n' + match[0];
        i += match[0].length;
      } else {
        result += sql[i];
        i++;
      }
    } else {
      result += sql[i];
      i++;
    }
  }

  return result.trim();
}

interface AlgebraToSqlProps {
  sql: string;
  className?: string;
}

export function AlgebraToSql({ sql, className }: AlgebraToSqlProps) {
  const [copied, setCopied] = useState(false);
  const formatted = useMemo(() => (sql ? formatSQL(sql) : ''), [sql]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!sql) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl border border-border/80/50 bg-muted/60 p-8',
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">SQL equivalent appears after evaluation</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border/80/50 bg-muted/60', className)}>
      <div className="flex items-center justify-between border-b border-border/80/40 bg-muted/80/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            Equivalent SQL
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground/80 transition-colors hover:bg-muted/80 hover:text-foreground/80"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-emerald-300/90">
        {formatted}
      </pre>
    </div>
  );
}
