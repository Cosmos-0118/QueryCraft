'use client';

import { useCallback } from 'react';
import { useAlgebraStore } from '@/stores/algebra-store';
import { useSqlEngine } from '@/hooks/use-sql-engine';
import { parse, algebraToSQL } from '@/lib/engine/algebra-parser';
import { evaluateAlgebra, buildContext } from '@/lib/engine/algebra-evaluator';
import type { StepResult } from '@/lib/engine/algebra-evaluator';
import { AlgebraInput } from '@/components/algebra/algebra-input';
import { ExpressionTree } from '@/components/algebra/expression-tree';
import { IntermediateResult } from '@/components/algebra/intermediate-result';
import { AlgebraToSql } from '@/components/algebra/algebra-to-sql';
import type { QueryResult } from '@/types/database';

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

const DATASETS: { name: string; data: Record<string, unknown> }[] = [
  { name: 'University', data: universityData },
  { name: 'Banking', data: bankingData },
];

export default function AlgebraPage() {
  const { isReady, execute, loadSQL, tables } = useSqlEngine();
  const store = useAlgebraStore();

  const handleLoadDataset = useCallback(
    (data: Record<string, unknown>) => {
      loadSQL(jsonToSQL(data as Record<string, Record<string, unknown>[]>));
    },
    [loadSQL],
  );

  const handleEvaluate = useCallback(() => {
    store.setError(null);
    try {
      const tree = parse(store.expression);
      store.setParsedTree(tree);
      store.setSqlEquivalent(algebraToSQL(tree));

      // Build context from loaded tables
      const tableData: Record<string, QueryResult> = {};
      for (const t of tables) {
        tableData[t.name] = execute(`SELECT * FROM "${t.name}"`);
      }
      const ctx = buildContext(tableData);
      const steps: StepResult[] = [];
      evaluateAlgebra(tree, ctx, steps);
      store.setSteps(steps);
      store.setActiveStepIndex(steps.length - 1);
    } catch (e) {
      store.setError(e instanceof Error ? e.message : String(e));
    }
  }, [store, tables, execute]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relational Algebra Playground</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Type relational algebra expressions and see them evaluated step by step.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {DATASETS.map((ds) => (
            <button
              key={ds.name}
              onClick={() => handleLoadDataset(ds.data)}
              disabled={!isReady}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              Load {ds.name}
            </button>
          ))}
          <button
            onClick={store.clear}
            className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/10"
          >
            Clear
          </button>
        </div>
      </div>

      {!isReady && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          Initializing SQL engine…
        </div>
      )}

      {tables.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Available tables:</span>
          {tables.map((t) => (
            <span key={t.name} className="rounded bg-muted px-2 py-0.5 font-mono">{t.name}</span>
          ))}
        </div>
      )}

      <AlgebraInput
        value={store.expression}
        onChange={store.setExpression}
        onEvaluate={handleEvaluate}
      />

      {store.error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-400">
          {store.error}
        </div>
      )}

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
        <AlgebraToSql sql={store.sqlEquivalent} />
      </div>

      <IntermediateResult
        steps={store.steps}
        activeIndex={store.activeStepIndex}
        onSelect={store.setActiveStepIndex}
      />
    </div>
  );
}
