'use client';

import { useState, useMemo, useEffect } from 'react';
import type { TableSchema, QueryResult } from '@/types/database';
import { TableViewer } from '@/components/visual/table-viewer';
import { cn } from '@/lib/utils/helpers';
import {
  X,
  Table2,
  KeyRound,
  ArrowRight,
  Eye,
  Columns,
  Database,
} from 'lucide-react';

interface TableBrowserProps {
  open: boolean;
  onClose: () => void;
  tables: TableSchema[];
  execute: (sql: string) => QueryResult;
}

interface InferredRelation {
  from: string;
  fromColumn: string;
  to: string;
  toColumn: string;
}

function inferRelations(tables: TableSchema[]): InferredRelation[] {
  const tableNames = new Set(tables.map((t) => t.name));
  const relations: InferredRelation[] = [];

  for (const table of tables) {
    for (const col of table.columns) {
      if (!col.name.endsWith('_id')) continue;
      const entity = col.name.slice(0, -3);
      const candidates = [entity, entity + 's', entity + 'es'];
      for (const candidate of candidates) {
        if (tableNames.has(candidate) && candidate !== table.name) {
          relations.push({ from: table.name, fromColumn: col.name, to: candidate, toColumn: 'id' });
          break;
        }
      }
    }
  }

  return relations;
}

export function TableBrowser({ open, onClose, tables, execute }: TableBrowserProps) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [view, setView] = useState<'schema' | 'data'>('schema');

  const relations = useMemo(() => inferRelations(tables), [tables]);
  const tableKey = tables.map((t) => t.name).sort().join(',');

  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!open || tables.length === 0) return;
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const r = execute(`SELECT COUNT(*) as c FROM "${t.name}"`);
      counts[t.name] = r.rows.length > 0 ? Number(r.rows[0].c) : 0;
    }
    setRowCounts(counts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey, open]);

  const [previewData, setPreviewData] = useState<QueryResult | null>(null);
  useEffect(() => {
    if (!selectedTable || view !== 'data') { setPreviewData(null); return; }
    setPreviewData(execute(`SELECT * FROM "${selectedTable}" LIMIT 100`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, view]);

  if (!open) return null;

  const activeSchema = tables.find((t) => t.name === selectedTable);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-[80vh] w-[90vw] max-w-5xl overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900 shadow-2xl shadow-violet-500/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between border-b border-zinc-700/50 bg-zinc-900/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15">
              <Database className="h-[18px] w-[18px] text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Table Browser</h2>
              <p className="text-xs text-zinc-500">
                {tables.length} table{tables.length !== 1 ? 's' : ''} loaded
                {relations.length > 0 &&
                  ` · ${relations.length} relation${relations.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sidebar */}
        <div className="w-56 shrink-0 overflow-y-auto border-r border-zinc-700/50 bg-zinc-900/50 pt-[73px]">
          <div className="p-3">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Tables
            </p>
            <div className="space-y-0.5">
              {tables.map((t) => (
                <button
                  key={t.name}
                  onClick={() => { setSelectedTable(t.name); setView('schema'); }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    selectedTable === t.name
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
                  )}
                >
                  <Table2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="ml-auto text-[10px] text-zinc-600">{rowCounts[t.name] ?? 0}</span>
                </button>
              ))}
            </div>

            {relations.length > 0 && (
              <>
                <p className="mb-2 mt-6 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Relations
                </p>
                <div className="space-y-1">
                  {relations.map((r, i) => (
                    <div key={i} className="rounded-lg bg-zinc-800/50 px-3 py-2 text-[11px] leading-relaxed">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-violet-300">{r.from}</span>
                        <span className="text-zinc-600">.</span>
                        <span className="text-zinc-400">{r.fromColumn}</span>
                      </div>
                      <div className="flex items-center gap-1 pl-2">
                        <ArrowRight className="h-2.5 w-2.5 text-zinc-600" />
                        <span className="font-medium text-emerald-300">{r.to}</span>
                        <span className="text-zinc-600">.</span>
                        <span className="text-zinc-400">{r.toColumn}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden pt-[73px]">
          {!selectedTable ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-500">
              <Columns className="h-10 w-10 text-zinc-700" />
              <p className="text-sm">Select a table to view its schema and data</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex items-center gap-1 border-b border-zinc-700/50 px-4 py-2">
                <button
                  onClick={() => setView('schema')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    view === 'schema'
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300',
                  )}
                >
                  <Columns className="h-3 w-3" />
                  Schema
                </button>
                <button
                  onClick={() => setView('data')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    view === 'data'
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300',
                  )}
                >
                  <Eye className="h-3 w-3" />
                  Data Preview
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {view === 'schema' && activeSchema && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Table2 className="h-4 w-4 text-violet-400" />
                      <h3 className="font-semibold text-zinc-200">{activeSchema.name}</h3>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                        {activeSchema.columns.length} columns
                      </span>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-zinc-700/50">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-700/50 bg-zinc-800/50">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400">Column</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400">Type</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400">Key</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400">Nullable</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSchema.columns.map((col) => {
                            const rel = relations.find(
                              (r) => r.from === activeSchema.name && r.fromColumn === col.name,
                            );
                            return (
                              <tr key={col.name} className="border-b border-zinc-800/50 last:border-0">
                                <td className="px-4 py-2 font-mono text-xs text-zinc-200">{col.name}</td>
                                <td className="px-4 py-2 text-xs text-zinc-400">{col.type}</td>
                                <td className="px-4 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {col.primaryKey && (
                                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                                        <KeyRound className="h-2.5 w-2.5" /> PK
                                      </span>
                                    )}
                                    {col.foreignKey ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                                        <ArrowRight className="h-2.5 w-2.5" /> FK → {col.foreignKey.table}.{col.foreignKey.column}
                                      </span>
                                    ) : rel ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                                        <ArrowRight className="h-2.5 w-2.5" /> FK → {rel.to}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-xs text-zinc-500">{col.nullable ? 'Yes' : 'No'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {view === 'data' && previewData && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-violet-400" />
                      <h3 className="font-semibold text-zinc-200">{selectedTable}</h3>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                        {previewData.rows.length} rows
                      </span>
                    </div>
                    <TableViewer columns={previewData.columns} rows={previewData.rows} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
