'use client';

import { useState, useCallback } from 'react';
import { useSqlEngine } from '@/hooks/use-sql-engine';
import { useSandboxStore } from '@/stores/sandbox-store';
import { SqlEditor } from '@/components/sandbox/sql-editor';
import { SchemaBrowser } from '@/components/sandbox/schema-browser';
import { QueryHistory } from '@/components/sandbox/query-history';
import { DataGeneratorDialog } from '@/components/sandbox/data-generator-dialog';
import { ResultPanel } from '@/components/visual/result-panel';
import { generateSampleDataSQL } from '@/lib/engine/data-generator';
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

export default function SandboxPage() {
  const { isReady, execute, loadSQL, reset, exportCSV, tables } = useSqlEngine();
  const store = useSandboxStore();
  const [result, setResult] = useState<QueryResult | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  const handleExecute = useCallback(() => {
    const q = store.query.trim();
    if (!q) return;
    const res = execute(q);
    setResult(res);
    store.setResults(res);
    store.addToHistory(q, !res.error);
  }, [execute, store]);

  const handleLoadDataset = useCallback(
    (data: Record<string, unknown>) => {
      const sql = jsonToSQL(data as Record<string, Record<string, unknown>[]>);
      const res = loadSQL(sql);
      setResult(res);
      if (!res.error) {
        store.setQuery('-- Dataset loaded! Try:\nSELECT * FROM ' + Object.keys(data)[0] + ' LIMIT 10;');
      }
    },
    [loadSQL, store],
  );

  const handleGenerate = useCallback(
    (tableName: string, columns: { name: string; type: 'integer' | 'text' | 'real' | 'date' | 'boolean'; primaryKey: boolean }[], rowCount: number) => {
      const sql = generateSampleDataSQL(tableName, columns, rowCount);
      const res = loadSQL(sql);
      setResult(res);
      if (!res.error) {
        store.setQuery(`SELECT * FROM "${tableName}" LIMIT 20;`);
      }
    },
    [loadSQL, store],
  );

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SQL Sandbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Write and execute SQL queries in your browser — powered by SQLite (WASM).
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
            onClick={() => setGenOpen(true)}
            disabled={!isReady}
            className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            Generate Data
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/10"
          >
            Reset DB
          </button>
        </div>
      </div>

      {!isReady && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          Initializing SQL engine…
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3 flex flex-col gap-4">
          <SqlEditor
            value={store.query}
            onChange={store.setQuery}
            onExecute={handleExecute}
            tables={tables}
          />

          <div className="flex gap-2">
            <button
              onClick={handleExecute}
              disabled={!isReady}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Run Query
            </button>
            {result && result.columns.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Export CSV
              </button>
            )}
          </div>

          {result?.error && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-400">
              {result.error}
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
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-600">
              Query executed successfully. {result.rowCount > 0 ? `${result.rowCount} row(s) affected.` : 'No rows returned.'}{' '}
              ({result.executionTimeMs.toFixed(1)}ms)
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <SchemaBrowser tables={tables} />
          <QueryHistory
            history={store.queryHistory}
            onSelect={store.setQuery}
            onClear={store.clearHistory}
          />
        </div>
      </div>

      <DataGeneratorDialog
        open={genOpen}
        onClose={() => setGenOpen(false)}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
