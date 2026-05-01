'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAlgebraStore } from '@/stores/algebra-store';
import { useLoadingStore } from '@/stores/loading-store';
import { useSqlEngine } from '@/hooks/use-sql-engine';
import { parse, algebraToSQL } from '@/lib/engine/algebra-parser';
import { evaluateAlgebra, buildContext } from '@/lib/engine/algebra-evaluator';
import type { StepResult } from '@/lib/engine/algebra-evaluator';
import { AlgebraInput } from '@/components/algebra/algebra-input';
import { ExpressionTree } from '@/components/algebra/expression-tree';
import { IntermediateResult } from '@/components/algebra/intermediate-result';
import { AlgebraToSql } from '@/components/algebra/algebra-to-sql';
import { TableBrowser } from '@/components/algebra/table-browser';
import { CreateTableModal } from '@/components/algebra/create-table-modal';
import type { QueryResult } from '@/types/database';
import { cn } from '@/lib/utils/helpers';

import {
  Database,
  ChevronDown,
  RotateCcw,
  Trash2,
  BookOpen,
  Sparkles,
  Table2,
  Plus,
  History,
  ClipboardPaste,
} from 'lucide-react';
import Link from 'next/link';




const UNIVERSITY_EXAMPLES = [
  { label: 'Select high GPA', expr: 'σ[gpa > 3.5](students)' },
  { label: 'Filter + project', expr: 'π[name](σ[gpa > 3.5](students))' },
  { label: 'Natural join', expr: 'students ⋈ enrollments' },
  { label: 'Left join', expr: 'students ⟕ enrollments' },
  { label: 'Intersection', expr: 'π[dept](students) ∩ π[name](departments)' },
  { label: 'Sort by GPA', expr: 'τ[gpa DESC](students)' },
  { label: 'Count by dept', expr: 'γ[department_id; COUNT(*) AS total](students)' },
];

const BANKING_EXAMPLES = [
  { label: 'High balance', expr: 'σ[balance > 5000](accounts)' },
  { label: 'Customer contacts', expr: 'π[name, email](customers)' },
  { label: 'Customers ⋈ Accounts', expr: 'customers ⋈ accounts' },
  { label: 'Anti-join', expr: 'customers ▷ accounts' },
  { label: 'Sum balances', expr: 'γ[customer_id; SUM(balance) AS total](accounts)' },
];

const CREDENTIA_EXAMPLES = [
  { label: 'All students', expr: 'σ[role = "STUDENT"](users)' },
  { label: 'Student contacts', expr: 'π[name, email](users)' },
  { label: 'Student ↔ info join', expr: 'users ⋈ student_info' },
  { label: 'Class enrollments', expr: 'classes ⋈ class_enrollment' },
  { label: 'Achievements per student', expr: 'γ[studentId; COUNT(*) AS total](achievements)' },
];

export default function AlgebraPage() {
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
  const store = useAlgebraStore();
  const { start: startLoading, stop: stopLoading } = useLoadingStore();
  const [browserOpen, setBrowserOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  const [inputFocusRequestKey, setInputFocusRequestKey] = useState(0);
  const [showGroups, setShowGroups] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importSql, setImportSql] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const [groupError, setGroupError] = useState<string | null>(null);
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
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
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

  // Restore algebra's preferred database when the engine becomes ready.
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
      setGroupError(null);
      setImportError(null);
    });
  }, [runWithActionLoading, store]);

  const handleResetWorkspace = useCallback(async () => {
    await runWithActionLoading('Resetting algebra workspace…', () => {
      reset();
      store.clear();
      store.clearHistory();
      setActiveDataset(null);
      setShowGroups(false);
      setShowImport(false);
      setImportSql('');
      setImportError(null);
      setGroupError(null);
    });
  }, [reset, runWithActionLoading, store]);

  const handleEvaluate = useCallback(() => {
    store.setError(null);
    try {
      const tree = parse(store.expression);
      store.setParsedTree(tree);
      store.setSqlEquivalent(algebraToSQL(tree));

      const tableData: Record<string, QueryResult> = {};
      for (const t of tables) {
        tableData[t.name] = execute(`SELECT * FROM "${t.name}"`);
      }
      const ctx = buildContext(tableData);
      const steps: StepResult[] = [];
      evaluateAlgebra(tree, ctx, steps);
      store.setSteps(steps);
      store.setActiveStepIndex(steps.length - 1);
      const finalResult = steps[steps.length - 1]?.result;
      store.addToHistory({
        expression: store.expression,
        success: true,
        sqlEquivalent: algebraToSQL(tree),
        stepCount: steps.length,
        result: finalResult
          ? {
            columns: finalResult.columns,
            rows: finalResult.rows.slice(0, 50),
            rowCount: finalResult.rows.length,
          }
          : undefined,
      });
      triggerInputFeedback('success');
      store.setExpression('');
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      store.setError(errMsg);
      store.addToHistory({
        expression: store.expression,
        success: false,
        sqlEquivalent: '',
        stepCount: 0,
        error: errMsg,
      });
      triggerInputFeedback('error');
    }
  }, [store, tables, execute, triggerInputFeedback]);

  const handleInsertTable = useCallback(
    (name: string) => {
      store.setExpression(store.expression + name);
      setInputFocusRequestKey((key) => key + 1);
    },
    [store],
  );

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

  const examples =
    activeDataset === 'banking'
      ? BANKING_EXAMPLES
      : activeDataset === 'credentia'
        ? CREDENTIA_EXAMPLES
        : UNIVERSITY_EXAMPLES;

  return (
    <>
      <div className="flex flex-col gap-5 p-6 lg:p-8">
        {/* ── Header ──────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="qc-icon-badge mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Relational Algebra Playground
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground/80">
                Write relational algebra expressions and explore them step by step
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={groupMenuRef}>
              <button
                onClick={() => setShowGroups((v) => !v)}
                disabled={!isReady}
                className="inline-flex items-center gap-2 rounded-xl border border-primary bg-primary px-3 py-2 text-[11px] font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 disabled:opacity-40"
              >
                <Database className="h-3.5 w-3.5 text-primary-foreground/90" />
                Groups
                <span className="rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[10px] text-primary-foreground/80">
                  {activeDatabase}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-primary-foreground/80" />
              </button>

              {showGroups && (
                <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-border/70 bg-card/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-md">
                  <div className="mb-2 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
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
                                ? 'border-border/70 bg-muted/60 text-foreground/80 hover:border-info/25 hover:bg-info/8'
                                : 'border-border/70 bg-muted/60 text-foreground/80 hover:border-primary/25 hover:bg-primary/8',
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Table
            </button>
            <button
              onClick={() => setShowImport(!showImport)}
              disabled={!isReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 disabled:opacity-40"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Import SQL
            </button>
            <button
              onClick={() => setBrowserOpen(true)}
              disabled={tables.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 disabled:opacity-40"
            >
              <Database className="h-3.5 w-3.5" />
              Browse Tables
            </button>
            <button
              onClick={handleClearInputOutput}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 active:scale-95"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
            <button
              onClick={handleResetWorkspace}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/90 active:scale-95"
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

        {/* ── Import SQL Panel ─────────────── */}
        {showImport && (
          <div className="qc-card-muted rounded-xl p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground/90">Import SQL</h3>
              <p className="text-[11px] text-muted-foreground/80">Paste CREATE TABLE / INSERT statements</p>
            </div>
            <textarea
              value={importSql}
              onChange={(e) => {
                setImportSql(e.target.value);
                if (importError) setImportError(null);
              }}
              placeholder={'-- Paste your SQL here\nCREATE TABLE "students" (\n  "id" INTEGER PRIMARY KEY,\n  "name" TEXT\n);'}
              className="qc-field w-full rounded-xl px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground/60"
              rows={6}
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
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground/90"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* History button */}
        {store.history.length > 0 && (
          <Link
            href="/algebra/history"
            className="qc-card-muted flex items-center gap-2.5 rounded-xl px-4 py-3 transition-colors hover:border-primary/30 hover:bg-surface-hover/60"
          >
            <History className="h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground/90">Expression History</span>
              <p className="text-[11px] text-muted-foreground/80">
                {store.history.length} expression{store.history.length === 1 ? '' : 's'} evaluated
              </p>
            </div>
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {store.history.length}
            </span>
          </Link>
        )}

        {/* ── Engine Status ──────────────────── */}
        {!isReady && (
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/40 px-4 py-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Initializing SQL engine…</span>
          </div>
        )}

        {/* ── Available Tables ───────────────── */}
        {tables.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground/80">Tables:</span>
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => handleInsertTable(t.name)}
                title={`Click to insert "${t.name}" into expression`}
                className="group inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/50 px-2.5 py-1 font-mono text-xs text-foreground/80 transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
              >
                <Table2 className="h-3 w-3 text-muted-foreground/80 transition-colors group-hover:text-primary" />
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Quick Examples ─────────────────── */}
        {tables.length > 0 && !store.expression && (
          <div className="flex flex-wrap items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground/60">Try:</span>
            {examples.map((ex) => (
              <button
                key={ex.label}
                onClick={() => store.setExpression(ex.expr)}
                className="rounded-md border border-dashed border-border/40 px-2.5 py-1 text-xs text-muted-foreground/80 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              >
                {ex.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Expression Input ───────────────── */}
        <AlgebraInput
          value={store.expression}
          onChange={store.setExpression}
          onEvaluate={handleEvaluate}
          tables={tables}
          tableNames={tables.map((t) => t.name)}
          historyExpressions={store.history.map((entry) => entry.expression)}
          executionFeedback={inputFeedback}
          focusRequestKey={inputFocusRequestKey}
        />

        {/* ── Error ──────────────────────────── */}
        {store.error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <span className="font-semibold">Error:</span> {store.error}
          </div>
        )}

        {/* ── Tree + SQL ─────────────────────── */}
        {(store.parsedTree || store.sqlEquivalent) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {store.parsedTree && (
              <ExpressionTree
                tree={store.parsedTree}
                activeNodeId={store.steps[store.activeStepIndex]?.node.id}
                onNodeClick={(id) => {
                  const idx = store.steps.findIndex((s) => s.node.id === id);
                  if (idx >= 0) store.setActiveStepIndex(idx);
                }}
              />
            )}
            {store.sqlEquivalent && <AlgebraToSql sql={store.sqlEquivalent} />}
          </div>
        )}

        {/* ── Step Results ────────────────────── */}
        {store.steps.length > 0 && (
          <IntermediateResult
            steps={store.steps}
            activeIndex={store.activeStepIndex}
            onSelect={store.setActiveStepIndex}
          />
        )}
      </div>

      {/* ── Table Browser Modal ──────────── */}
      <TableBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        tables={tables}
        execute={execute}
      />
      <CreateTableModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        execute={execute}
        onCreated={refreshTables}
      />
    </>
  );
}
