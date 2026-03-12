'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/helpers';
import type { HistoryEntry } from '@/stores/sandbox-store';
import {
  History,
  Check,
  X,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  CornerDownLeft,
  XCircle,
  CheckCircle2,
  Table2,
  Copy,
} from 'lucide-react';

interface QueryHistoryProps {
  history: HistoryEntry[];
  onSelect: (query: string) => void;
  onClear: () => void;
  className?: string;
}

export function QueryHistory({ history, onSelect, onClear, className }: QueryHistoryProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (query: string, idx: number) => {
    navigator.clipboard.writeText(query);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  if (history.length === 0) {
    return (
      <div className={cn('rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
        <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
          <History className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            History
          </span>
        </div>
        <div className="px-4 py-8 text-center">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/60">
            <Clock className="h-4 w-4 text-zinc-600" />
          </div>
          <p className="text-xs text-zinc-600">No queries executed yet.</p>
          <p className="mt-0.5 text-[10px] text-zinc-700">Run a query to see it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <History className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          History
        </span>
        <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">
          {history.length}
        </span>
        <button
          onClick={onClear}
          className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
          title="Clear history"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        {history.map((entry, i) => {
          const isExpanded = expandedIndex === i;
          const hasResult = entry.result && entry.result.columns.length > 0;
          const hasError = !!entry.result?.error;
          const isCopied = copiedIndex === i;

          return (
            <div
              key={`${entry.timestamp}-${i}`}
              className={cn(
                'border-b border-zinc-800/40 last:border-0 transition-colors',
                isExpanded && 'bg-zinc-800/15',
              )}
            >
              {/* Entry header */}
              <div className="flex items-center gap-1.5 px-3 py-2">
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-800/60 hover:text-zinc-400"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
                {entry.success ? (
                  <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                ) : (
                  <X className="h-3 w-3 shrink-0 text-red-400" />
                )}
                <button
                  onClick={() => onSelect(entry.query)}
                  className="min-w-0 flex-1 text-left"
                  title="Click to load query"
                >
                  <code className="line-clamp-1 block font-mono text-[11px] text-zinc-300">
                    {entry.query}
                  </code>
                </button>
                <button
                  onClick={() => handleCopy(entry.query, i)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-800/60 hover:text-zinc-400"
                  title="Copy query"
                >
                  {isCopied ? (
                    <Check className="h-2.5 w-2.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-2.5 w-2.5" />
                  )}
                </button>
              </div>

              {/* Timestamp + meta */}
              <div className="flex items-center gap-2 px-3 pb-1.5 pl-[2.75rem]">
                <Clock className="h-2.5 w-2.5 text-zinc-700" />
                <span className="text-[10px] text-zinc-600">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                {entry.result && (
                  <>
                    <span className="text-zinc-800">·</span>
                    <span className="text-[10px] text-zinc-600">
                      {entry.result.executionTimeMs.toFixed(1)}ms
                    </span>
                    {hasResult && (
                      <>
                        <span className="text-zinc-800">·</span>
                        <span className="text-[10px] text-zinc-600">
                          {entry.result.rowCount} row{entry.result.rowCount !== 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="mx-3 mb-3 mt-1 space-y-2">
                  {/* Query display */}
                  <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <CornerDownLeft className="h-3 w-3 text-violet-400" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                        Query
                      </span>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-300">
                      {entry.query}
                    </pre>
                  </div>

                  {/* Error output */}
                  {hasError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      <span className="font-mono text-[11px] text-red-400">{entry.result!.error}</span>
                    </div>
                  )}

                  {/* Success with no rows */}
                  {!hasError && !hasResult && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span className="text-[11px] text-emerald-400">
                        {entry.result!.rowCount > 0
                          ? `${entry.result!.rowCount} row(s) affected`
                          : 'Query executed successfully'}
                        {' · '}
                        {entry.result!.executionTimeMs.toFixed(1)}ms
                      </span>
                    </div>
                  )}

                  {/* Result table */}
                  {hasResult && entry.result && (
                    <div className="overflow-hidden rounded-lg border border-zinc-800/60">
                      <div className="flex items-center gap-1.5 border-b border-zinc-800/50 bg-zinc-800/20 px-3 py-1.5">
                        <Table2 className="h-3 w-3 text-emerald-400" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                          Output
                        </span>
                        <span className="ml-auto text-[10px] text-zinc-600">
                          {entry.result.rowCount} row{entry.result.rowCount !== 1 ? 's' : ''}
                          {entry.result.rows.length < entry.result.rowCount && ` (showing ${entry.result.rows.length})`}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[300px] text-[11px]">
                          <thead>
                            <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                              {entry.result.columns.map((col) => (
                                <th
                                  key={col}
                                  className="whitespace-nowrap px-3 py-1.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {entry.result.rows.map((row, ri) => (
                              <tr
                                key={ri}
                                className="border-b border-zinc-800/30 last:border-0 transition-colors hover:bg-zinc-800/20"
                              >
                                {entry.result!.columns.map((col) => (
                                  <td
                                    key={col}
                                    className="whitespace-nowrap px-3 py-1.5 font-mono text-zinc-300"
                                  >
                                    {row[col] === null || row[col] === undefined ? (
                                      <span className="text-zinc-700 italic">NULL</span>
                                    ) : (
                                      String(row[col])
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onSelect(entry.query)}
                      className="inline-flex items-center gap-1 rounded-md bg-zinc-800/50 px-2.5 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <CornerDownLeft className="h-2.5 w-2.5" />
                      Load in Editor
                    </button>
                    <button
                      onClick={() => handleCopy(entry.query, i)}
                      className="inline-flex items-center gap-1 rounded-md bg-zinc-800/50 px-2.5 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <Copy className="h-2.5 w-2.5" />
                      {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
