'use client';

import { useState } from 'react';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useThemeStore } from '@/stores/theme-store';
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
  const { theme } = useThemeStore();
  const history = store.queryHistory;
  const isLightTheme = theme === 'light';
  const cardClass = isLightTheme
    ? 'rounded-xl border border-slate-200 bg-white shadow-sm'
    : 'rounded-xl border border-zinc-700/50 bg-zinc-900/60';

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
            className={cn(
              'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
              isLightTheme
                ? 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800'
                : 'border-zinc-700/50 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200',
            )}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Query History</h1>
            <p className={cn('mt-0.5 text-[11px]', isLightTheme ? 'text-slate-500' : 'text-zinc-500')}>
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
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors',
              isLightTheme
                ? 'border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50'
                : 'border-red-500/20 text-red-400/80 hover:border-red-500/40 hover:bg-red-500/10',
            )}
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
          <div
            className={cn(
              'flex items-center gap-0.5 rounded-xl border p-1',
              isLightTheme ? 'border-slate-200 bg-slate-100/90' : 'border-zinc-800/60 bg-zinc-900/60',
            )}
          >
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
                  isLightTheme
                    ? filter === tab.key
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                    : filter === tab.key
                      ? 'bg-zinc-800/80 text-zinc-200'
                      : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300',
                )}
              >
                {tab.label}
                <span className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] font-bold',
                  isLightTheme
                    ? filter === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-600'
                    : filter === tab.key
                      ? 'bg-violet-500/15 text-violet-400'
                      : 'bg-zinc-800/40 text-zinc-600',
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search
              className={cn(
                'absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2',
                isLightTheme ? 'text-slate-400' : 'text-zinc-600',
              )}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search queries…"
              className={cn(
                'w-full rounded-lg border py-2 pl-9 pr-3 text-xs outline-none transition-colors',
                isLightTheme
                  ? 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-300'
                  : 'border-zinc-800/60 bg-zinc-900/60 text-zinc-200 placeholder-zinc-600 focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20',
              )}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {history.length === 0 && (
        <div className={cn(cardClass, 'py-16 text-center')}>
          <div
            className={cn(
              'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl',
              isLightTheme ? 'bg-slate-100' : 'bg-zinc-800/60',
            )}
          >
            <Clock className={cn('h-6 w-6', isLightTheme ? 'text-slate-500' : 'text-zinc-600')} />
          </div>
          <p className={cn('text-sm font-medium', isLightTheme ? 'text-slate-700' : 'text-zinc-400')}>No queries yet</p>
          <p className={cn('mt-1 text-xs', isLightTheme ? 'text-slate-500' : 'text-zinc-600')}>
            Run some SQL in the{' '}
            <Link
              href="/sandbox"
              className={cn(isLightTheme ? 'text-slate-700 hover:text-slate-900 hover:underline' : 'text-emerald-400 hover:underline')}
            >
              sandbox
            </Link>
            {' '}to see your history here.
          </p>
        </div>
      )}

      {/* No filter results */}
      {history.length > 0 && filtered.length === 0 && (
        <div className={cn(cardClass, 'py-10 text-center')}>
          <p className={cn('text-sm', isLightTheme ? 'text-slate-600' : 'text-zinc-400')}>No queries match your filters.</p>
        </div>
      )}

      {/* History entries */}
      {filtered.length > 0 && (
        <div className={cn(
          'divide-y rounded-xl border',
          isLightTheme
            ? 'divide-slate-200 border-slate-200 bg-white shadow-sm'
            : 'divide-zinc-800/50 border-zinc-700/50 bg-zinc-900/60',
        )}>
          {filtered.map((entry, i) => (
            <HistoryEntryCard
              key={`${entry.timestamp}-${i}`}
              entry={entry}
              isExpanded={expandedIndex === i}
              isCopied={copiedIndex === i}
              isLightTheme={isLightTheme}
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
  isLightTheme,
  onToggle,
  onCopy,
  onLoad,
}: {
  entry: HistoryEntry;
  isExpanded: boolean;
  isCopied: boolean;
  isLightTheme: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onLoad: () => void;
}) {
  const database = entry.database || 'main';
  const statementResults = toStatementResults(entry);
  const hasResult = statementResults.some((statement) => statement.columns.length > 0);

  return (
    <div className={cn('transition-colors', isExpanded && (isLightTheme ? 'bg-slate-50' : 'bg-zinc-800/10'))}>
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          onClick={onToggle}
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
            isLightTheme
              ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              : 'text-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-400',
          )}
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <div className="min-w-0 flex-1">
          {/* Query preview */}
          <div className="flex items-center gap-2">
            {entry.success ? (
              <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', isLightTheme ? 'text-emerald-600' : 'text-emerald-400')} />
            ) : (
              <XCircle className={cn('h-3.5 w-3.5 shrink-0', isLightTheme ? 'text-red-600' : 'text-red-400')} />
            )}
            <button onClick={onLoad} className="min-w-0 flex-1 text-left" aria-label="Load query in editor">
              <code className={cn(
                'block font-mono text-[12px] leading-relaxed',
                isLightTheme ? 'text-slate-900' : 'text-zinc-300',
                !isExpanded && 'line-clamp-2',
              )}>
                {entry.query}
              </code>
            </button>
          </div>

          {/* Meta row */}
          <div className="mt-1.5 flex items-center gap-3 pl-5">
            <span className={cn('flex items-center gap-1 text-[10px]', isLightTheme ? 'text-slate-500' : 'text-zinc-600')}>
              <Clock className="h-2.5 w-2.5" />
              {new Date(entry.timestamp).toLocaleString()}
            </span>
            <span className={cn(
              'rounded px-1.5 py-0.5 text-[10px]',
              isLightTheme ? 'bg-slate-100 text-slate-600' : 'bg-zinc-800/70 text-zinc-500',
            )}>
              {database}
            </span>
            {entry.result && (
              <>
                <span className={cn('text-[10px]', isLightTheme ? 'text-slate-300' : 'text-zinc-700')}>·</span>
                <span className={cn('text-[10px]', isLightTheme ? 'text-slate-500' : 'text-zinc-600')}>
                  {entry.result.executionTimeMs.toFixed(1)}ms
                </span>
              </>
            )}
            {hasResult && (
              <>
                <span className={cn('text-[10px]', isLightTheme ? 'text-slate-300' : 'text-zinc-700')}>·</span>
                <span className={cn('text-[10px]', isLightTheme ? 'text-slate-500' : 'text-zinc-600')}>
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
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              isLightTheme
                ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                : 'text-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-300',
            )}
            aria-label="Copy query"
          >
            {isCopied ? <Check className={cn('h-3.5 w-3.5', isLightTheme ? 'text-emerald-600' : 'text-emerald-400')} /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <Link
            href="/sandbox"
            onClick={onLoad}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              isLightTheme
                ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                : 'text-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-300',
            )}
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
            <div className={cn(
              'rounded-lg border p-4',
              isLightTheme ? 'border-slate-200 bg-slate-50' : 'border-zinc-800/60 bg-zinc-950/50',
            )}>
              <div className="mb-2 flex items-center gap-1.5">
                <CornerDownLeft className={cn('h-3 w-3', isLightTheme ? 'text-slate-500' : 'text-violet-400')} />
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider', isLightTheme ? 'text-slate-500' : 'text-zinc-600')}>
                  Full Query
                </span>
              </div>
              <pre className={cn('overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed', isLightTheme ? 'text-slate-800' : 'text-zinc-300')}>
                {entry.query}
              </pre>
            </div>

            <StatementTabs statementResults={statementResults} isLightTheme={isLightTheme} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatementTabs({ statementResults, isLightTheme }: { statementResults: HistoryStatementResult[]; isLightTheme: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = statementResults[Math.min(activeIndex, statementResults.length - 1)] ?? null;

  if (!active) return null;

  return (
    <div className={cn(
      'overflow-hidden rounded-lg border',
      isLightTheme ? 'border-slate-200' : 'border-zinc-800/60',
    )}>
      {statementResults.length > 1 && (
        <div className={cn(
          'flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5',
          isLightTheme ? 'border-slate-200 bg-slate-50' : 'border-zinc-800/50 bg-zinc-900/60',
        )}>
          {statementResults.map((statement, idx) => (
            <button
              key={`${idx}-${statement.statement}`}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                'shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
                isLightTheme
                  ? idx === activeIndex
                    ? 'border-slate-700 bg-slate-700 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  : idx === activeIndex
                    ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                    : 'border-zinc-700/60 bg-zinc-800/50 text-zinc-500 hover:text-zinc-300',
              )}
            >
              S{idx + 1}
            </button>
          ))}
        </div>
      )}

      <div className={cn(
        'border-b px-3 py-2',
        isLightTheme ? 'border-slate-200 bg-slate-50' : 'border-zinc-800/50 bg-zinc-800/20',
      )}>
        <div className="flex items-center gap-1.5">
          <Table2 className={cn('h-3 w-3', isLightTheme ? 'text-slate-600' : 'text-emerald-400')} />
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider', isLightTheme ? 'text-slate-500' : 'text-zinc-600')}>
            {statementResults.length > 1 ? `Statement ${activeIndex + 1}` : 'Result'}
          </span>
          <span className={cn('ml-auto text-[10px]', isLightTheme ? 'text-slate-500' : 'text-zinc-600')}>
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
              <tr className={cn(
                'border-b',
                isLightTheme ? 'border-slate-200 bg-slate-50' : 'border-zinc-800/50 bg-zinc-900/50',
              )}>
                {active.columns.map((col) => (
                  <th
                    key={col}
                    className={cn(
                      'whitespace-nowrap px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider',
                      isLightTheme ? 'text-slate-500' : 'text-zinc-500',
                    )}
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
                  className={cn(
                    'border-b last:border-0 transition-colors',
                    isLightTheme ? 'border-slate-200 hover:bg-slate-50' : 'border-zinc-800/30 hover:bg-zinc-800/20',
                  )}
                >
                  {active.columns.map((col) => (
                    <td
                      key={col}
                      className={cn(
                        'whitespace-nowrap px-3 py-1.5 font-mono',
                        isLightTheme ? 'text-slate-800' : 'text-zinc-300',
                      )}
                    >
                      {row[col] === null || row[col] === undefined ? (
                        <span className={cn('italic', isLightTheme ? 'text-slate-400' : 'text-zinc-700')}>NULL</span>
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
        <div className={cn(
          'flex items-center gap-2 rounded-b-lg border-t px-4 py-3',
          isLightTheme ? 'border-slate-200 bg-emerald-50' : 'border-zinc-800/60 bg-emerald-500/5',
        )}>
          <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', isLightTheme ? 'text-emerald-700' : 'text-emerald-400')} />
          <span className={cn('text-[11px]', isLightTheme ? 'text-emerald-700' : 'text-emerald-400')}>
            {active.rowCount > 0 ? `${active.rowCount} row(s) affected` : 'Query executed successfully'}
          </span>
        </div>
      )}
    </div>
  );
}
