'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTrcStore } from '@/stores/trc-store';
import type { TrcHistoryEntry } from '@/stores/trc-store';
import {
  ArrowLeft,
  Clock,
  Check,
  Copy,
  Trash2,
  CornerDownLeft,
  XCircle,
  CheckCircle2,
  Table2,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

export default function TrcHistoryPage() {
  const store = useTrcStore();
  const history = store.history;

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const [search, setSearch] = useState('');

  const handleCopy = (query: string, idx: number) => {
    navigator.clipboard.writeText(query);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleLoadInEditor = (expression: string) => {
    store.setExpression(expression);
  };

  const filtered = history.filter((entry) => {
    if (filter === 'success' && !entry.success) return false;
    if (filter === 'error' && entry.success) return false;
    if (search && !entry.expression.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const successCount = history.filter((e) => e.success).length;
  const errorCount = history.filter((e) => !e.success).length;

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/tuple-calculus"
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-800/50 text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">TRC History</h1>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {history.length} expression{history.length === 1 ? '' : 's'} recorded
              {history.length > 0 && (
                <span>
                  {' · '}{successCount} succeeded{' · '}{errorCount} failed
                </span>
              )}
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={store.clearHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-[11px] font-medium text-red-400/80 transition-all hover:border-red-500/40 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-0.5 rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-1">
            {([
              { key: 'all', label: 'All', count: history.length },
              { key: 'success', label: 'Success', count: successCount },
              { key: 'error', label: 'Errors', count: errorCount },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all',
                  filter === tab.key
                    ? 'bg-zinc-800/80 text-zinc-200'
                    : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-bold',
                    filter === tab.key ? 'bg-cyan-500/15 text-cyan-300' : 'bg-zinc-800/40 text-zinc-600',
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expressions..."
              className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 py-2 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/60">
            <Clock className="h-6 w-6 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-400">No TRC expressions yet</p>
          <p className="mt-1 text-xs text-zinc-600">
            Evaluate expressions in{' '}
            <Link href="/tuple-calculus" className="text-cyan-300 hover:underline">Tuple Calculus</Link>
            {' '}to see history here.
          </p>
        </div>
      )}

      {history.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 py-10 text-center">
          <p className="text-sm text-zinc-400">No expressions match your filters.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="divide-y divide-zinc-800/50 rounded-xl border border-zinc-700/50 bg-zinc-900/60">
          {filtered.map((entry, i) => (
            <HistoryEntryCard
              key={`${entry.timestamp}-${i}`}
              entry={entry}
              isExpanded={expandedIndex === i}
              isCopied={copiedIndex === i}
              onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
              onCopy={() => handleCopy(entry.expression, i)}
              onLoad={() => handleLoadInEditor(entry.expression)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryEntryCard({
  entry,
  isExpanded,
  isCopied,
  onToggle,
  onCopy,
  onLoad,
}: {
  entry: TrcHistoryEntry;
  isExpanded: boolean;
  isCopied: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onLoad: () => void;
}) {
  const hasResult = !!entry.result && entry.result.columns.length > 0;
  const hasError = !!entry.error;

  return (
    <div className={cn('transition-colors', isExpanded && 'bg-zinc-800/10')}>
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          onClick={onToggle}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-800/60 hover:text-zinc-400"
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {entry.success ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
            )}
            <button onClick={onLoad} className="min-w-0 flex-1 text-left" aria-label="Load expression in editor">
              <code className={cn('block font-mono text-[12px] leading-relaxed text-zinc-300', !isExpanded && 'line-clamp-2')}>
                {entry.expression}
              </code>
            </button>
          </div>

          <div className="mt-1.5 flex items-center gap-3 pl-5">
            <span className="flex items-center gap-1 text-[10px] text-zinc-600">
              <Clock className="h-2.5 w-2.5" />
              {new Date(entry.timestamp).toLocaleString()}
            </span>
            {entry.result && (
              <>
                <span className="text-[10px] text-zinc-700">.</span>
                <span className="text-[10px] text-zinc-600">{entry.result.executionTimeMs.toFixed(1)}ms</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onCopy}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
            aria-label="Copy expression"
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <Link
            href="/tuple-calculus"
            onClick={onLoad}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
            aria-label="Load expression in editor"
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pl-[3.25rem]">
          <div className="space-y-3">
            {entry.sqlEquivalent && (
              <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <Table2 className="h-3 w-3 text-cyan-300" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Translated SQL</span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-cyan-200/90">{entry.sqlEquivalent}</pre>
              </div>
            )}

            {hasError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                <span className="font-mono text-[11px] text-red-400">{entry.error}</span>
              </div>
            )}

            {hasResult && entry.result && (
              <div className="overflow-hidden rounded-lg border border-zinc-800/60">
                <div className="flex items-center gap-1.5 border-b border-zinc-800/50 bg-zinc-800/20 px-3 py-2">
                  <Table2 className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Result</span>
                  <span className="ml-auto text-[10px] text-zinc-600">
                    {entry.result.rowCount} row{entry.result.rowCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                        {entry.result.columns.map((col) => (
                          <th key={col} className="whitespace-nowrap px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entry.result.rows.map((row, ri) => (
                        <tr key={ri} className="border-b border-zinc-800/30 last:border-0 transition-colors hover:bg-zinc-800/20">
                          {entry.result!.columns.map((col) => (
                            <td key={col} className="whitespace-nowrap px-3 py-1.5 font-mono text-zinc-300">
                              {row[col] === null || row[col] === undefined ? <span className="italic text-zinc-700">NULL</span> : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
