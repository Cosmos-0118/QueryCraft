'use client';

import { useCallback, useState } from 'react';
import { useAlgebraStore } from '@/stores/algebra-store';
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
  GraduationCap,
  Landmark,
  Database,
  Trash2,
  BookOpen,
  Sparkles,
  Table2,
  Plus,
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
      const t =
        typeof sample === 'number'
          ? Number.isInteger(sample)
            ? 'INTEGER'
            : 'REAL'
          : 'TEXT';
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

export default function AlgebraPage() {
  const { isReady, execute, loadSQL, tables, refreshTables } = useSqlEngine();
  const store = useAlgebraStore();
  const [browserOpen, setBrowserOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);

  const handleLoadDataset = useCallback(
    (name: string, data: Record<string, unknown>) => {
      loadSQL(jsonToSQL(data as Record<string, Record<string, unknown>[]>));
      setActiveDataset(name);
    },
    [loadSQL],
  );

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
    }
  }, [store, tables, execute]);

  const handleInsertTable = useCallback(
    (name: string) => {
      store.setExpression(store.expression + name);
    },
    [store],
  );

  const examples = activeDataset === 'Banking' ? BANKING_EXAMPLES : UNIVERSITY_EXAMPLES;

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* ── Header ──────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-violet-500/25">
              <Sparkles className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                Relational Algebra Playground
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Write relational algebra expressions and explore them step by step
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {DATASETS.map((ds) => {
              const Icon = ds.icon;
              return (
                <button
                  key={ds.name}
                  onClick={() => handleLoadDataset(ds.name, ds.data)}
                  disabled={!isReady}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40',
                    activeDataset === ds.name
                      ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                      : 'border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-300',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {ds.name}
                </button>
              );
            })}
            <div className="mx-1 h-5 w-px bg-zinc-700/50" />
            <button
              onClick={() => setCreateOpen(true)}
              disabled={!isReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Table
            </button>
            <button
              onClick={() => setBrowserOpen(true)}
              disabled={tables.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition-all hover:border-violet-500/50 hover:bg-violet-500/20 disabled:opacity-40"
            >
              <Database className="h-3.5 w-3.5" />
              Browse Tables
            </button>
            <button
              onClick={() => {
                store.clear();
                setActiveDataset(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400/80 transition-all hover:border-red-500/40 hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* History button */}
        {store.history.length > 0 && (
          <Link
            href="/algebra/history"
            className="flex items-center gap-2.5 rounded-xl border border-zinc-700/50 bg-zinc-900/60 px-4 py-3 transition-colors hover:border-violet-500/30 hover:bg-zinc-800/40"
          >
            <History className="h-4 w-4 text-violet-400" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-zinc-200">Expression History</span>
              <p className="text-[11px] text-zinc-500">
                {store.history.length} expression{store.history.length === 1 ? '' : 's'} evaluated
              </p>
            </div>
            <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">
              {store.history.length}
            </span>
          </Link>
        )}

        {/* ── Engine Status ──────────────────── */}
        {!isReady && (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
            <span className="text-sm text-zinc-400">Initializing SQL engine…</span>
          </div>
        )}

        {/* ── Available Tables ───────────────── */}
        {tables.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Tables:</span>
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => handleInsertTable(t.name)}
                title={`Click to insert "${t.name}" into expression`}
                className="group inline-flex items-center gap-1 rounded-md border border-zinc-700/40 bg-zinc-800/50 px-2.5 py-1 font-mono text-xs text-zinc-300 transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
              >
                <Table2 className="h-3 w-3 text-zinc-500 transition-colors group-hover:text-violet-400" />
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Quick Examples ─────────────────── */}
        {tables.length > 0 && !store.expression && (
          <div className="flex flex-wrap items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-zinc-600" />
            <span className="text-xs text-zinc-600">Try:</span>
            {examples.map((ex) => (
              <button
                key={ex.label}
                onClick={() => store.setExpression(ex.expr)}
                className="rounded-md border border-dashed border-zinc-700/40 px-2.5 py-1 text-xs text-zinc-500 transition-all hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-violet-300"
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
          tableNames={tables.map((t) => t.name)}
        />

        {/* ── Error ──────────────────────────── */}
        {store.error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
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
