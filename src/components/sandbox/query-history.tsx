'use client';

import { cn } from '@/lib/utils/helpers';

interface HistoryEntry {
  query: string;
  timestamp: number;
  success: boolean;
}

interface QueryHistoryProps {
  history: HistoryEntry[];
  onSelect: (query: string) => void;
  onClear: () => void;
  className?: string;
}

export function QueryHistory({ history, onSelect, onClear, className }: QueryHistoryProps) {
  if (history.length === 0) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
        <p className="text-sm text-muted-foreground">No queries executed yet.</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-semibold text-muted-foreground">
          History ({history.length})
        </span>
        <button
          onClick={onClear}
          className="text-xs text-red-400 hover:text-red-500"
        >
          Clear
        </button>
      </div>
      <ul className="max-h-64 overflow-y-auto divide-y divide-border">
        {history.map((entry, i) => (
          <li key={i}>
            <button
              onClick={() => onSelect(entry.query)}
              className="w-full px-4 py-2 text-left transition-colors hover:bg-muted"
            >
              <div className="flex items-center gap-2">
                <span className={entry.success ? 'text-green-500' : 'text-red-500'}>
                  {entry.success ? '✓' : '✗'}
                </span>
                <code className="line-clamp-1 flex-1 font-mono text-xs">{entry.query}</code>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
