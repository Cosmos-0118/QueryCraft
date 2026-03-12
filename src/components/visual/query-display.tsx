'use client';

import { cn } from '@/lib/utils/helpers';
import { useState } from 'react';

interface QueryDisplayProps {
  query: string;
  language?: 'sql' | 'algebra';
  className?: string;
}

export function QueryDisplay({ query, language = 'sql', className }: QueryDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple keyword highlighting
  const highlighted =
    language === 'sql'
      ? query.replace(
          /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|BETWEEN|LIKE|ORDER BY|GROUP BY|HAVING|LIMIT|DISTINCT|AS|SET|INTO|VALUES|TABLE|INDEX|NULL|IS|COUNT|SUM|AVG|MIN|MAX|UNION|INTERSECT|EXCEPT)\b/gi,
          '<span class="text-primary font-semibold">$1</span>',
        )
      : query.replace(
          /(σ|π|⋈|∪|−|×|ρ|÷)/g,
          '<span class="text-accent font-bold text-lg">$1</span>',
        );

  return (
    <div className={cn('group relative rounded-lg border border-border bg-muted/50', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {language === 'sql' ? 'SQL' : 'Relational Algebra'}
        </span>
        <button
          onClick={handleCopy}
          className="rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}
