'use client';

import { useState } from 'react';
import { useSandboxStore } from '@/stores/sandbox-store';
import type { HistoryEntry } from '@/stores/sandbox-store';
import Link from 'next/link';
import { SqlErrorAlert } from '@/components/visual/sql-error-alert';
import {
  ArrowLeft,
  Clock,
  Check,
  XCircle,
  Copy,
  Trash2,
  CornerDownLeft,
  CheckCircle2,
  Table2,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

interface HistoryStatementResult {
  statement: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
  errorDetails?: HistoryEntry['result']['errorDetails'];
}

function toStatementResults(entry: HistoryEntry): HistoryStatementResult[] {
  if (entry.result.statementResults && entry.result.statementResults.length > 0) {
    return entry.result.statementResults;
  }

  return [
    {
      statement: entry.query,
      columns: entry.result.columns,
      rows: entry.result.rows,
      rowCount: entry.result.rowCount,
      executionTimeMs: entry.result.executionTimeMs,
      error: entry.result.error,
      errorDetails: entry.result.errorDetails,
    },
  ];
}

export default function HistoryPage() {
  const store = useSandboxStore();
  const history = store.queryHistory;

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const [search, setSearch] = useState('');

  const handleCopy = (query: string, idx: number) => {
    navigator.clipboard.writeText(query);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleLoadInEditor = (query: string, database?: string) => {
    store.setQuery(query);
    store.setPendingDatabase(database && database.trim() ? database : 'main');
  };

  const filtered = history.filter((entry) => {
    if (filter === 'success' && !entry.success) return false;
    if (filter === 'error' && entry.success) return false;
    if (search && !entry.query.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const successCount = history.filter((e) => e.success).length;
  const errorCount = history.filter((e) => !e.success).length;

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/sandbox"
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-800/50 text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Query History</h1>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {history.length} quer{history.length === 1 ? 'y' : 'ies'} recorded
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

      {/* Filters + Search */}
      {history.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Filter tabs */}
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
                <span className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] font-bold',
                  filter === tab.key ? 'bg-violet-500/15 text-violet-400' : 'bg-zinc-800/40 text-zinc-600',
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search queries…"
              className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 py-2 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {history.length === 0 && (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/60">
            <Clock className="h-6 w-6 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-400">No queries yet</p>
          <p className="mt-1 text-xs text-zinc-600">
            Run some SQL in the{' '}
            <Link href="/sandbox" className="text-emerald-400 hover:underline">sandbox</Link>
            {' '}to see your history here.
          </p>
        </div>
      )}

      {/* No filter results */}
      {history.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 py-10 text-center">
          <p className="text-sm text-zinc-400">No queries match your filters.</p>
        </div>
      )}

      {/* History entries */}
      {filtered.length > 0 && (
        <div className="divide-y divide-zinc-800/50 rounded-xl border border-zinc-700/50 bg-zinc-900/60">
          {filtered.map((entry, i) => (
            <HistoryEntryCard
              key={`${entry.timestamp}-${i}`}
              entry={entry}
              isExpanded={expandedIndex === i}
              isCopied={copiedIndex === i}
              onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
              onCopy={() => handleCopy(entry.query, i)}
              onLoad={() => handleLoadInEditor(entry.query, entry.database)}
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
  entry: HistoryEntry;
  isExpanded: boolean;
  isCopied: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onLoad: () => void;
}) {
  const database = entry.database || 'main';
  const statementResults = toStatementResults(entry);
  const hasResult = statementResults.some((statement) => statement.columns.length > 0);

  return (
    <div className={cn('transition-colors', isExpanded && 'bg-zinc-800/10')}>
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          onClick={onToggle}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-800/60 hover:text-zinc-400"
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <div className="min-w-0 flex-1">
          {/* Query preview */}
          <div className="flex items-center gap-2">
            {entry.success ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
            )}
            <button onClick={onLoad} className="min-w-0 flex-1 text-left" aria-label="Load query in editor">
              <code className={cn(
                'block font-mono text-[12px] leading-relaxed text-zinc-300',
                !isExpanded && 'line-clamp-2',
              )}>
                {entry.query}
              </code>
            </button>
          </div>

          {/* Meta row */}
          <div className="mt-1.5 flex items-center gap-3 pl-5">
            <span className="flex items-center gap-1 text-[10px] text-zinc-600">
              <Clock className="h-2.5 w-2.5" />
              {new Date(entry.timestamp).toLocaleString()}
            </span>
            <span className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] text-zinc-500">
              {database}
            </span>
            {entry.result && (
              <>
                <span className="text-[10px] text-zinc-700">·</span>
                <span className="text-[10px] text-zinc-600">
                  {entry.result.executionTimeMs.toFixed(1)}ms
                </span>
              </>
            )}
            {hasResult && (
              <>
                <span className="text-[10px] text-zinc-700">·</span>
                <span className="text-[10px] text-zinc-600">
                  {entry.result.rowCount} row{entry.result.rowCount !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onCopy}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
            aria-label="Copy query"
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <Link
            href="/sandbox"
            onClick={onLoad}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
            aria-label="Load query in editor"
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pl-[3.25rem]">
          <div className="space-y-3">
            {/* Full query */}
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <CornerDownLeft className="h-3 w-3 text-violet-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Full Query
                </span>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-zinc-300">
                {entry.query}
              </pre>
            </div>

            <StatementTabs statementResults={statementResults} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatementTabs({ statementResults }: { statementResults: HistoryStatementResult[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = statementResults[Math.min(activeIndex, statementResults.length - 1)] ?? null;

  if (!active) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800/60">
      {statementResults.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800/50 bg-zinc-900/60 px-2 py-1.5">
          {statementResults.map((statement, idx) => (
            <button
              key={`${idx}-${statement.statement}`}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                'shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
                idx === activeIndex
                  ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                  : 'border-zinc-700/60 bg-zinc-800/50 text-zinc-500 hover:text-zinc-300',
              )}
            >
              S{idx + 1}
            </button>
          ))}
        </div>
      )}

      <div className="border-b border-zinc-800/50 bg-zinc-800/20 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Table2 className="h-3 w-3 text-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            {statementResults.length > 1 ? `Statement ${activeIndex + 1}` : 'Result'}
          </span>
          <span className="ml-auto text-[10px] text-zinc-600">
            {active.executionTimeMs.toFixed(1)}ms
          </span>
        </div>
      </div>

      {active.error ? (
        <div className="p-2">
          <SqlErrorAlert
            error={active.error}
            details={active.errorDetails}
            compact
          />
        </div>
      ) : active.columns.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                {active.columns.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-zinc-800/30 last:border-0 transition-colors hover:bg-zinc-800/20"
                >
                  {active.columns.map((col) => (
                    <td
                      key={col}
                      className="whitespace-nowrap px-3 py-1.5 font-mono text-zinc-300"
                    >
                      {row[col] === null || row[col] === undefined ? (
                        <span className="italic text-zinc-700">NULL</span>
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
      ) : (
        <div className="flex items-center gap-2 rounded-b-lg border-t border-zinc-800/60 bg-emerald-500/5 px-4 py-3">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span className="text-[11px] text-emerald-400">
            {active.rowCount > 0 ? `${active.rowCount} row(s) affected` : 'Query executed successfully'}
          </span>
        </div>
      )}
    </div>
  );
}
