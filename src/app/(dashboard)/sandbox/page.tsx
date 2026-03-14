'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSqlEngine } from '@/hooks/use-sql-engine';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useSessionPersistence } from '@/hooks/use-session-persistence';
import { SqlEditor } from '@/components/sandbox/sql-editor';
import { SchemaBrowser } from '@/components/sandbox/schema-browser';

import { CreateTableModal } from '@/components/algebra/create-table-modal';
import { ResultPanel } from '@/components/visual/result-panel';
import { SqlErrorAlert } from '@/components/visual/sql-error-alert';
import { cn } from '@/lib/utils/helpers';
import type { QueryResult } from '@/types/database';
import {
  Terminal,
  GraduationCap,
  Landmark,
  Play,
  Download,
  Plus,
  ClipboardPaste,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Table2,
  History,
} from 'lucide-react';
import Link from 'next/link';

import universityData from '@/../seed/datasets/university.json';
import bankingData from '@/../seed/datasets/banking.json';

function jsonToSQL(data: Record<string, Record<string, unknown>[]>): string {
  const statements: string[] = [];
  for (const [table, rows] of Object.entries(data)) {
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    const colDefs = cols.map((c) => {
      const sample = rows[0][c];
      const t = typeof sample === 'number' ? (Number.isInteger(sample) ? 'INTEGER' : 'REAL') : 'TEXT';
      return `"${c}" ${t}${c === 'id' ? ' PRIMARY KEY' : ''}`;
    });
    statements.push(`CREATE TABLE IF NOT EXISTS "${table}" (${colDefs.join(', ')});`);
    for (const row of rows) {
      const vals = cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      statements.push(`INSERT INTO "${table}" VALUES (${vals.join(', ')});`);
    }
  }
  return statements.join('\n');
}

const DATASETS = [
  { name: 'University', icon: GraduationCap, data: universityData as Record<string, unknown> },
  { name: 'Banking', icon: Landmark, data: bankingData as Record<string, unknown> },
];

export default function SandboxPage() {
  const { isReady, execute, loadSQL, reset, exportCSV, tables, refreshTables } = useSqlEngine();
  const store = useSandboxStore();
  const [result, setResult] = useState<QueryResult | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importSql, setImportSql] = useState('');
  const [importErrorResult, setImportErrorResult] = useState<QueryResult | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  const [editorFeedback, setEditorFeedback] = useState<'idle' | 'success' | 'error'>('idle');
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerEditorFeedback = useCallback((feedback: 'success' | 'error') => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setEditorFeedback(feedback);
    feedbackTimeoutRef.current = setTimeout(() => {
      setEditorFeedback('idle');
      feedbackTimeoutRef.current = null;
    }, 700);
  }, []);

  // Auto-save session
  const { save } = useSessionPersistence();
  useEffect(() => {
    save({ lastPage: 'sandbox' });
  }, [save]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleExecute = useCallback(() => {
    const q = store.query.trim();
    if (!q) return;
    const res = execute(q);
    setResult(res);
    store.setResults(res);
    store.addToHistory(q, !res.error, res);
    triggerEditorFeedback(res.error ? 'error' : 'success');
    if (!res.error) {
      store.setQuery('');
    }
  }, [execute, store, triggerEditorFeedback]);

  const handleLoadDataset = useCallback(
    (name: string, data: Record<string, unknown>) => {
      const sql = jsonToSQL(data as Record<string, Record<string, unknown>[]>);
      const res = loadSQL(sql);
      setResult(res);
      setActiveDataset(name);
      if (!res.error) {
        store.setQuery('-- Dataset loaded! Try:\nSELECT * FROM ' + Object.keys(data)[0] + ' LIMIT 10;');
      }
    },
    [loadSQL, store],
  );

  const handleImportSQL = useCallback(() => {
    setImportErrorResult(null);
    const sql = importSql.trim();
    if (!sql) return;
    const res = loadSQL(sql);
    setResult(res);
    if (res.error) {
      setImportErrorResult(res);
      return;
    }
    setShowImport(false);
    setImportSql('');
    setActiveDataset(null);
    const tableMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/i);
    if (tableMatch) {
      store.setQuery(`SELECT * FROM "${tableMatch[1]}" LIMIT 20;`);
    }
  }, [importSql, loadSQL, store]);

  const handleExportCSV = useCallback(() => {
    if (!result || result.columns.length === 0) return;
    const csv = exportCSV(result);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [result, exportCSV]);

  const tableCount = tables.length;
  const historyCount = store.queryHistory.length;

  return (
    <>
      <div className="flex h-full flex-col gap-3 p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-emerald-500/25"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%)' }}
            >
              <Terminal className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">SQL Sandbox</h1>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {tableCount} table{tableCount !== 1 ? 's' : ''}
                </span>
                <span className="text-zinc-700">&middot;</span>
                <span>{historyCount} queries run</span>
                <span className="text-zinc-700">&middot;</span>
                <span className="text-zinc-600">MySQL-compatible</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Dataset presets */}
            <div className="flex items-center gap-0.5 rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-1 backdrop-blur-sm">
              {DATASETS.map((ds) => {
                const Icon = ds.icon;
                return (
                  <button
                    key={ds.name}
                    onClick={() => handleLoadDataset(ds.name, ds.data)}
                    disabled={!isReady}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all duration-150 disabled:opacity-40',
                      activeDataset === ds.name
                        ? 'bg-zinc-800/80 text-emerald-300'
                        : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {ds.name}
                  </button>
                );
              })}
            </div>

            <div className="mx-0.5 h-5 w-px bg-zinc-700/50" />

            {/* Create Table */}
            <button
              onClick={() => setCreateOpen(true)}
              disabled={!isReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Table
            </button>

            {/* Import SQL */}
            <button
              onClick={() => setShowImport(!showImport)}
              disabled={!isReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-300 transition-all hover:border-violet-500/50 hover:bg-violet-500/20 disabled:opacity-40"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Import SQL
            </button>

            {/* Reset */}
            <button
              onClick={() => { reset(); setActiveDataset(null); setResult(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-[11px] font-medium text-red-400/80 transition-all hover:border-red-500/40 hover:bg-red-500/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Import SQL Panel */}
        {showImport && (
          <div className="rounded-xl border border-violet-500/30 bg-zinc-900/80 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">Import SQL</h3>
              <p className="text-[11px] text-zinc-500">Paste CREATE TABLE / INSERT statements from Table Generator</p>
            </div>
            <textarea
              value={importSql}
              onChange={(e) => {
                setImportSql(e.target.value);
                if (importErrorResult) setImportErrorResult(null);
              }}
              placeholder={'-- Paste your SQL here\nCREATE TABLE "students" (\n  "id" INTEGER PRIMARY KEY,\n  "name" TEXT\n);'}
              className="w-full rounded-xl border border-zinc-700/50 bg-zinc-950/60 px-4 py-3 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/15"
              rows={6}
            />
            {importErrorResult?.error && (
              <SqlErrorAlert
                error={importErrorResult.error}
                details={importErrorResult.errorDetails}
                compact
                className="mt-2"
              />
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleImportSQL}
                disabled={!importSql.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-500/20 transition-all hover:bg-violet-500 disabled:opacity-40"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Run Import
              </button>
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportSql('');
                  setImportErrorResult(null);
                }}
                className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Engine Status */}
        {!isReady && (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-sm text-zinc-400">Initializing SQL engine…</span>
          </div>
        )}

        {/* Available Tables */}
        {tables.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Tables:</span>
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => store.setQuery(`SELECT * FROM "${t.name}" LIMIT 20;`)}
                title={`Query "${t.name}"`}
                className="group inline-flex items-center gap-1 rounded-md border border-zinc-700/40 bg-zinc-800/50 px-2.5 py-1 font-mono text-xs text-zinc-300 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
              >
                <Table2 className="h-3 w-3 text-zinc-500 transition-colors group-hover:text-emerald-400" />
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-4">
          {/* Editor + Results */}
          <div className="flex flex-col gap-3 overflow-auto lg:col-span-3">
            <SqlEditor
              value={store.query}
              onChange={store.setQuery}
              onExecute={handleExecute}
              tables={tables}
              executionFeedback={editorFeedback}
              hasOutput={Boolean(result)}
            />

            {/* Run bar */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExecute}
                disabled={!isReady}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition-all duration-200 hover:shadow-emerald-500/25 disabled:opacity-40 disabled:shadow-none"
                style={{
                  background: isReady
                    ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    : 'rgba(63,63,70,0.5)',
                }}
              >
                <Play className="h-4 w-4" />
                Run Query
              </button>
              {result && result.columns.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700/50 px-4 py-2 text-sm font-medium text-zinc-400 transition-all hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-200"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
              )}
            </div>

            {/* Error */}
            {result?.error && (
              <SqlErrorAlert error={result.error} details={result.errorDetails} />
            )}

            {/* Results table */}
            {result && !result.error && result.columns.length > 0 && (
              <ResultPanel
                columns={result.columns}
                rows={result.rows}
                rowCount={result.rowCount}
                executionTimeMs={result.executionTimeMs}
              />
            )}

            {/* Success message (no columns) */}
            {result && !result.error && result.columns.length === 0 && (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Query executed successfully.{' '}
                  {result.rowCount > 0 ? `${result.rowCount} row(s) affected.` : 'No rows returned.'}{' '}
                  ({result.executionTimeMs.toFixed(1)}ms)
                </span>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-3 overflow-auto">
            <SchemaBrowser tables={tables} />
            <Link
              href="/sandbox/history"
              className="flex items-center gap-2.5 rounded-xl border border-zinc-700/50 bg-zinc-900/60 px-4 py-3 transition-colors hover:border-violet-500/30 hover:bg-zinc-800/40"
            >
              <History className="h-4 w-4 text-violet-400" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-zinc-200">Query History</span>
                {historyCount > 0 && (
                  <p className="text-[11px] text-zinc-500">{historyCount} quer{historyCount === 1 ? 'y' : 'ies'} recorded</p>
                )}
              </div>
              <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">
                {historyCount}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateTableModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        execute={execute}
        onCreated={refreshTables}
      />
    </>
  );
}
