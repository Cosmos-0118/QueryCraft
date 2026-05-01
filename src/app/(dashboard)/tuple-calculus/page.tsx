'use client';

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSqlEngine } from '@/hooks/use-sql-engine';
import { useTrcStore } from '@/stores/trc-store';
import { useLoadingStore } from '@/stores/loading-store';
import { tupleCalculusToSQL } from '@/lib/engine/tuple-calculus';
import { ResultPanel } from '@/components/visual/result-panel';
import { AlgebraToSql } from '@/components/algebra/algebra-to-sql';
import { TableBrowser } from '@/components/algebra/table-browser';
import { CreateTableModal } from '@/components/algebra/create-table-modal';
import { TupleCalculusInput } from '@/components/tuple-calculus/tuple-calculus-input';
import { cn } from '@/lib/utils/helpers';

import {
  FunctionSquare,
  ClipboardPaste,
  Database,
  ChevronDown,
  RotateCcw,
  Plus,
  Table2,
  History,
  Trash2,
  CheckCircle2,
  XCircle,
  BookOpen,
} from 'lucide-react';




const UNIVERSITY_EXAMPLES = [
  { label: 'All students', expr: '{ t | students(t) }' },
  { label: 'High GPA names', expr: '{ <t.name, t.gpa> | students(t) ∧ t.gpa > 3.6 }' },
  { label: 'Students with enrollments', expr: '{ t | students(t) ∧ ∃e (enrollments(e) ∧ e.student_id = t.id) }' },
  { label: 'Students in all departments', expr: '{ t | students(t) ∧ ∀d (departments(d) ∨ d.id = t.department_id) }' },
];

const BANKING_EXAMPLES = [
  { label: 'All accounts', expr: '{ a | accounts(a) }' },
  { label: 'Large balances', expr: '{ <a.account_id, a.balance> | accounts(a) ∧ a.balance > 5000 }' },
  { label: 'Customers with account', expr: '{ c | customers(c) ∧ ∃a (accounts(a) ∧ a.customer_id = c.customer_id) }' },
];

const CREDENTIA_EXAMPLES = [
  { label: 'All users', expr: '{ u | users(u) }' },
  { label: 'Faculty users', expr: '{ <u.name, u.email> | users(u) ∧ u.role = "FACULTY" }' },
  { label: 'Students with classes', expr: '{ s | student_info(s) ∧ ∃e (class_enrollment(e) ∧ e.studentId = s.id) }' },
  {
    label: 'Students with achievements',
    expr: '{ s | student_info(s) ∧ ∃a (achievements(a) ∧ a.studentId = s.id) }',
  },
];

export default function TupleCalculusPage() {
  const {
    isReady,
    execute,
    loadSQL,
    reset,
    tables,
    refreshTables,
    databases,
    activeDatabase,

    switchDatabase,
    seedDatasets,
  } = useSqlEngine();
  const store = useTrcStore();
  const { start: startLoading, stop: stopLoading } = useLoadingStore();

  const [browserOpen, setBrowserOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [importSql, setImportSql] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const [groupError, setGroupError] = useState<string | null>(null);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  const [inputFocusRequestKey, setInputFocusRequestKey] = useState(0);
  const [result, setResult] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
    error?: string;
  } | null>(null);
  const [inputFeedback, setInputFeedback] = useState<'idle' | 'success' | 'error'>('idle');
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);


  const seedDatasetNames = useMemo(
    () => new Set(seedDatasets.map((dataset) => dataset.name.toLowerCase())),
    [seedDatasets],
  );

  const triggerInputFeedback = useCallback((feedback: 'success' | 'error') => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setInputFeedback(feedback);
    feedbackTimeoutRef.current = setTimeout(() => {
      setInputFeedback('idle');
      feedbackTimeoutRef.current = null;
    }, 700);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!groupMenuRef.current) return;
      const target = event.target as Node;
      if (!groupMenuRef.current.contains(target)) {
        setShowGroups(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Restore the TRC's preferred database when the engine becomes ready.
  useEffect(() => {
    if (!isReady) return;
    const preferred = store.selectedDatabase;
    if (preferred && preferred !== activeDatabase) {
      const result = switchDatabase(preferred);
      if (result.error) {
        store.setSelectedDatabase(activeDatabase);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // Keep the store's selectedDatabase in sync whenever the engine's active database changes
  useEffect(() => {
    if (isReady && activeDatabase) {
      store.setSelectedDatabase(activeDatabase);
    }
  }, [isReady, activeDatabase, store]);

  const handleEvaluate = useCallback(() => {
    const expr = store.expression.trim();
    if (!expr) return;

    store.setError(null);

    try {
      const sql = tupleCalculusToSQL(expr);
      store.setSqlEquivalent(sql);
      const res = execute(sql);
      setResult(res);

      if (res.error) {
        store.setError(res.error);
        store.addToHistory({
          expression: expr,
          success: false,
          sqlEquivalent: sql,
          error: res.error,
        });
        triggerInputFeedback('error');
        return;
      }

      store.addToHistory({
        expression: expr,
        success: true,
        sqlEquivalent: sql,
        result: {
          columns: res.columns,
          rows: res.rows.slice(0, 50),
          rowCount: res.rowCount,
          executionTimeMs: res.executionTimeMs,
        },
      });
      triggerInputFeedback('success');
      store.setExpression('');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      store.setError(err);
      store.setSqlEquivalent('');
      store.addToHistory({
        expression: expr,
        success: false,
        sqlEquivalent: '',
        error: err,
      });
      triggerInputFeedback('error');
    }
  }, [execute, store, triggerInputFeedback]);

  const handleImportSQL = useCallback(() => {
    setImportError(null);
    const sql = importSql.trim();
    if (!sql) return;

    const res = loadSQL(sql);
    if (res.error) {
      setImportError(res.error);
      return;
    }

    setShowImport(false);
    setImportSql('');
    setActiveDataset(null);
  }, [importSql, loadSQL]);

  const handleCreateGroup = useCallback(() => {
    setGroupError(null);
    const rawName = window.prompt('Enter group name');
    if (rawName === null) return;

    const groupName = rawName.trim().toLowerCase();
    if (!groupName) {
      setGroupError('Group name is required.');
      return;
    }

    if (!/^[a-z][a-z0-9_]*$/.test(groupName)) {
      setGroupError('Use lowercase letters, numbers, and underscore only (must start with a letter).');
      return;
    }

    const createRes = execute(`CREATE DATABASE IF NOT EXISTS "${groupName}"`);
    if (createRes.error) {
      setGroupError(createRes.error);
      return;
    }

    const switchRes = switchDatabase(groupName);
    if (switchRes.error) {
      setGroupError(switchRes.error);
      return;
    }

    setActiveDataset(null);
    setShowGroups(false);
  }, [execute, switchDatabase]);

  const runWithActionLoading = useCallback(
    async (message: string, action: () => void) => {
      startLoading(message);
      try {
        action();
        await new Promise((resolve) => setTimeout(resolve, 420));
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading],
  );

  const handleClearInputOutput = useCallback(async () => {
    await runWithActionLoading('Clearing expression and output…', () => {
      store.clear();
      setResult(null);
      setGroupError(null);
      setImportError(null);
    });
  }, [runWithActionLoading, store]);

  const handleResetWorkspace = useCallback(async () => {
    await runWithActionLoading('Resetting tuple calculus workspace…', () => {
      reset();
      store.clear();
      store.clearHistory();
      setResult(null);
      setActiveDataset(null);
      setShowGroups(false);
      setShowImport(false);
      setImportSql('');
      setImportError(null);
      setGroupError(null);
    });
  }, [reset, runWithActionLoading, store]);

  const examples =
    activeDataset === 'banking'
      ? BANKING_EXAMPLES
      : activeDataset === 'credentia'
        ? CREDENTIA_EXAMPLES
        : UNIVERSITY_EXAMPLES;

  return (
    <>
      <div className="flex flex-col gap-5 p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="qc-icon-badge mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <FunctionSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Tuple Relational Calculus</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Write TRC expressions and execute them via SQL translation</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={groupMenuRef}>
              <button
                onClick={() => setShowGroups((v) => !v)}
                disabled={!isReady}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-primary px-3 py-2 text-[11px] font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 disabled:opacity-40"
              >
                <Database className="h-3.5 w-3.5 text-primary-foreground/80" />
                Groups
                <span className="rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[10px] text-primary-foreground/70">
                  {activeDatabase}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-primary-foreground/60" />
              </button>

              {showGroups && (
                <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-2xl shadow-black/40 backdrop-blur-md">
                  <div className="mb-2 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Table groups
                  </div>
                  <button
                    onClick={handleCreateGroup}
                    className="mb-2 w-full rounded-lg border border-success/30 bg-success/10 px-2.5 py-2 text-left text-xs font-medium text-success transition-all hover:border-success/50 hover:bg-success/20"
                  >
                    + Create Group
                  </button>
                  <div className="space-y-1">
                    {databases.map((groupName) => {
                      const normalized = groupName.toLowerCase();
                      const isSystem = normalized === 'main' || seedDatasetNames.has(normalized);
                      const isActive = activeDatabase === groupName;
                      return (
                        <button
                          key={groupName}
                          onClick={() => {
                            const res = switchDatabase(groupName);
                            if (!res.error) {
                              setShowGroups(false);
                              setActiveDataset(seedDatasetNames.has(normalized) ? normalized : null);
                            }
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition-all',
                            isActive
                              ? isSystem
                                ? 'border-info/35 bg-info/12 text-foreground'
                                : 'border-primary/35 bg-primary/14 text-foreground'
                              : isSystem
                                ? 'border-border bg-muted text-foreground/90 hover:border-info/25 hover:bg-info/8'
                                : 'border-border bg-muted text-foreground/90 hover:border-primary/25 hover:bg-primary/8',
                          )}
                        >
                          <span className="truncate font-medium">{groupName}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              isSystem ? 'bg-info/15 text-info' : 'bg-primary/15 text-primary',
                            )}
                          >
                            {isSystem ? 'system' : 'user'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mx-1 h-5 w-px bg-border/70" />

            <button
              onClick={() => setCreateOpen(true)}
              disabled={!isReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Table
            </button>

            <button
              onClick={() => setShowImport(!showImport)}
              disabled={!isReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 disabled:opacity-40"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Import SQL
            </button>

            <button
              onClick={() => setBrowserOpen(true)}
              disabled={tables.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 disabled:opacity-40"
            >
              <Database className="h-3.5 w-3.5" />
              Browse Tables
            </button>

            <button
              onClick={handleClearInputOutput}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 active:scale-95"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
            <button
              onClick={handleResetWorkspace}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        {groupError && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {groupError}
          </div>
        )}

        {showImport && (
          <div className="qc-card-muted rounded-xl p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Import SQL</h3>
              <p className="text-[11px] text-muted-foreground">Paste CREATE TABLE / INSERT statements</p>
            </div>
            <textarea
              value={importSql}
              onChange={(e) => {
                setImportSql(e.target.value);
                if (importError) setImportError(null);
              }}
              rows={6}
              placeholder={'-- Paste your SQL here\nCREATE TABLE "students" (\n  "id" INTEGER PRIMARY KEY,\n  "name" TEXT\n);'}
              className="qc-field w-full rounded-xl px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground/70"
            />
            {importError && (
              <p className="mt-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                Import failed: {importError}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleImportSQL}
                disabled={!importSql.trim()}
                className="qc-primary-action inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Run Import
              </button>
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportSql('');
                  setImportError(null);
                }}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {store.history.length > 0 && (
          <Link
            href="/tuple-calculus/history"
            className="qc-card-muted flex items-center gap-2.5 rounded-xl px-4 py-3 transition-colors hover:border-primary/30 hover:bg-surface-hover/60"
          >
            <History className="h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground">TRC History</span>
              <p className="text-[11px] text-muted-foreground">{store.history.length} expression{store.history.length === 1 ? '' : 's'} evaluated</p>
            </div>
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{store.history.length}</span>
          </Link>
        )}

        {!isReady && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Initializing SQL engine...</span>
          </div>
        )}

        {tables.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Tables:</span>
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  store.setExpression(`{ t | ${t.name}(t) }`);
                  setInputFocusRequestKey((key) => key + 1);
                }}
                className="group inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-xs text-foreground/90 transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
              >
                <Table2 className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-primary" />
                {t.name}
              </button>
            ))}
          </div>
        )}

        {tables.length > 0 && !store.expression && (
          <div className="flex flex-wrap items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span className="text-xs text-muted-foreground/70">Try:</span>
            {examples.map((example) => (
              <button
                key={example.label}
                onClick={() => store.setExpression(example.expr)}
                className="rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              >
                {example.label}
              </button>
            ))}
          </div>
        )}

        <TupleCalculusInput
          value={store.expression}
          onChange={store.setExpression}
          onEvaluate={handleEvaluate}
          tables={tables}
          historyExpressions={store.history.map((entry) => entry.expression)}
          executionFeedback={inputFeedback}
          focusRequestKey={inputFocusRequestKey}
        />

        {store.error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <span className="font-semibold">Error:</span> {store.error}
          </div>
        )}

        {store.sqlEquivalent && <AlgebraToSql sql={store.sqlEquivalent} />}

        {result?.error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{result.error}</span>
          </div>
        )}

        {result && !result.error && result.columns.length > 0 && (
          <ResultPanel
            columns={result.columns}
            rows={result.rows}
            rowCount={result.rowCount}
            executionTimeMs={result.executionTimeMs}
          />
        )}

        {result && !result.error && result.columns.length === 0 && (
          <div className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Query executed successfully. {result.rowCount > 0 ? `${result.rowCount} row(s) affected.` : 'No rows returned.'}{' '}
              ({result.executionTimeMs.toFixed(1)}ms)
            </span>
          </div>
        )}
      </div>

      <TableBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} tables={tables} execute={execute} />
      <CreateTableModal open={createOpen} onClose={() => setCreateOpen(false)} execute={execute} onCreated={refreshTables} />
    </>
  );
}
