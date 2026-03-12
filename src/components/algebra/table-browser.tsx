'use client';

import { useState, useMemo, useCallback } from 'react';
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
  Plus,
  Trash2,
} from 'lucide-react';

interface TableBrowserProps {
  open: boolean;
  onClose: () => void;
  tables: TableSchema[];
  execute: (sql: string) => QueryResult;
  onRefresh: () => void;
}

interface InferredRelation {
  from: string;
  fromColumn: string;
  to: string;
  toColumn: string;
}

interface NewColumn {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL';
  pk: boolean;
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
          relations.push({
            from: table.name,
            fromColumn: col.name,
            to: candidate,
            toColumn: 'id',
          });
          break;
        }
      }
    }
  }

  return relations;
}

export function TableBrowser({ open, onClose, tables, execute, onRefresh }: TableBrowserProps) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [view, setView] = useState<'schema' | 'data' | 'create'>('schema');

  // Create table form state
  const [newTableName, setNewTableName] = useState('');
  const [newColumns, setNewColumns] = useState<NewColumn[]>([
    { name: 'id', type: 'INTEGER', pk: true },
  ]);
  const [newRows, setNewRows] = useState<string[][]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  const relations = useMemo(() => inferRelations(tables), [tables]);

  // Pre-compute row counts once when tables change, not on every render
  const rowCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const r = execute(`SELECT COUNT(*) as c FROM "${t.name}"`);
      counts[t.name] = r.rows.length > 0 ? Number(r.rows[0].c) : 0;
    }
    return counts;
  }, [tables, execute]);

  // Only fetch preview data when actively viewing it
  const previewData = useMemo(() => {
    if (!selectedTable || view !== 'data') return null;
    return execute(`SELECT * FROM "${selectedTable}" LIMIT 100`);
  }, [selectedTable, view, execute]);

  const handleAddColumn = useCallback(() => {
    setNewColumns((prev) => [...prev, { name: '', type: 'TEXT', pk: false }]);
  }, []);

  const handleRemoveColumn = useCallback((idx: number) => {
    setNewColumns((prev) => prev.filter((_, i) => i !== idx));
    setNewRows((prev) => prev.map((row) => row.filter((_, i) => i !== idx)));
  }, []);

  const handleUpdateColumn = useCallback((idx: number, field: keyof NewColumn, value: string | boolean) => {
    setNewColumns((prev) =>
      prev.map((col, i) => (i === idx ? { ...col, [field]: value } : col)),
    );
  }, []);

  const handleAddRow = useCallback(() => {
    setNewRows((prev) => [...prev, newColumns.map(() => '')]);
  }, [newColumns]);

  const handleUpdateCell = useCallback((rowIdx: number, colIdx: number, value: string) => {
    setNewRows((prev) =>
      prev.map((row, ri) =>
        ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? value : cell)) : row,
      ),
    );
  }, []);

  const handleRemoveRow = useCallback((idx: number) => {
    setNewRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleCreateTable = useCallback(() => {
    setCreateError(null);
    const name = newTableName.trim();
    if (!name) { setCreateError('Table name is required'); return; }
    if (!/^[a-zA-Z_]\w*$/.test(name)) { setCreateError('Invalid table name (use letters, digits, underscores)'); return; }
    const validCols = newColumns.filter((c) => c.name.trim());
    if (validCols.length === 0) { setCreateError('Add at least one column'); return; }

    const colDefs = validCols.map((c) => {
      let def = `"${c.name.trim()}" ${c.type}`;
      if (c.pk) def += ' PRIMARY KEY';
      return def;
    }).join(', ');

    const result = execute(`CREATE TABLE "${name}" (${colDefs})`);
    if (result.error) { setCreateError(result.error); return; }

    // Insert rows
    for (const row of newRows) {
      const vals = validCols.map((c, ci) => {
        const v = row[ci]?.trim() ?? '';
        if (!v) return 'NULL';
        if (c.type === 'INTEGER') return String(parseInt(v, 10) || 0);
        if (c.type === 'REAL') return String(parseFloat(v) || 0);
        return `'${v.replace(/'/g, "''")}'`;
      });
      const insertResult = execute(`INSERT INTO "${name}" VALUES (${vals.join(', ')})`);
      if (insertResult.error) { setCreateError(insertResult.error); return; }
    }

    // Reset form and switch to view the new table
    onRefresh();
    setNewTableName('');
    setNewColumns([{ name: 'id', type: 'INTEGER', pk: true }]);
    setNewRows([]);
    setSelectedTable(name);
    setView('schema');
  }, [newTableName, newColumns, newRows, execute, onRefresh]);

  const resetCreateForm = useCallback(() => {
    setNewTableName('');
    setNewColumns([{ name: 'id', type: 'INTEGER', pk: true }]);
    setNewRows([]);
    setCreateError(null);
  }, []);

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
                  onClick={() => {
                    setSelectedTable(t.name);
                    setView('schema');
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    selectedTable === t.name && view !== 'create'
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
                  )}
                >
                  <Table2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="ml-auto text-[10px] text-zinc-600">
                    {rowCounts[t.name] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {/* Create Table Button */}
            <button
              onClick={() => {
                setView('create');
                setSelectedTable(null);
                resetCreateForm();
              }}
              className={cn(
                'mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm font-medium transition-all',
                view === 'create'
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                  : 'border-zinc-700/40 text-zinc-500 hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-violet-300',
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Table
            </button>

            {relations.length > 0 && (
              <>
                <p className="mb-2 mt-6 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Relations
                </p>
                <div className="space-y-1">
                  {relations.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-zinc-800/50 px-3 py-2 text-[11px] leading-relaxed"
                    >
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
          {/* ── Create Table View ──────────── */}
          {view === 'create' && (
            <div className="flex flex-1 flex-col overflow-auto p-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-200">
                <Plus className="h-4 w-4 text-violet-400" />
                Create New Table
              </h3>

              {/* Table Name */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Table Name
                </label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="e.g. employees"
                  className="w-full max-w-xs rounded-lg border border-zinc-700/50 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
                />
              </div>

              {/* Columns */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Columns
                </label>
                <div className="space-y-1.5">
                  {newColumns.map((col, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => handleUpdateColumn(ci, 'name', e.target.value)}
                        placeholder="column name"
                        className="w-40 rounded-md border border-zinc-700/40 bg-zinc-950/50 px-2.5 py-1.5 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/40"
                      />
                      <select
                        value={col.type}
                        onChange={(e) => handleUpdateColumn(ci, 'type', e.target.value)}
                        className="rounded-md border border-zinc-700/40 bg-zinc-950/50 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500/40"
                      >
                        <option value="TEXT">TEXT</option>
                        <option value="INTEGER">INTEGER</option>
                        <option value="REAL">REAL</option>
                      </select>
                      <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                        <input
                          type="checkbox"
                          checked={col.pk}
                          onChange={(e) => handleUpdateColumn(ci, 'pk', e.target.checked)}
                          className="rounded border-zinc-600 accent-violet-500"
                        />
                        PK
                      </label>
                      {newColumns.length > 1 && (
                        <button
                          onClick={() => handleRemoveColumn(ci)}
                          className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 hover:bg-zinc-800 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddColumn}
                  className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-300"
                >
                  <Plus className="h-3 w-3" /> Add column
                </button>
              </div>

              {/* Sample Rows */}
              <div className="mb-5">
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Rows <span className="text-zinc-600">(optional)</span>
                </label>
                {newRows.length > 0 && (
                  <div className="mb-2 overflow-auto rounded-lg border border-zinc-700/40">
                    <table className="text-xs">
                      <thead>
                        <tr className="border-b border-zinc-700/40 bg-zinc-800/40">
                          {newColumns.map((c, ci) => (
                            <th key={ci} className="px-3 py-1.5 text-left font-medium text-zinc-500">
                              {c.name || `col${ci + 1}`}
                            </th>
                          ))}
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {newRows.map((row, ri) => (
                          <tr key={ri} className="border-b border-zinc-800/40 last:border-0">
                            {newColumns.map((_, ci) => (
                              <td key={ci} className="px-1 py-1">
                                <input
                                  type="text"
                                  value={row[ci] ?? ''}
                                  onChange={(e) => handleUpdateCell(ri, ci, e.target.value)}
                                  className="w-full min-w-[80px] rounded border border-transparent bg-transparent px-2 py-1 text-xs text-zinc-300 outline-none focus:border-zinc-700 focus:bg-zinc-950/50"
                                />
                              </td>
                            ))}
                            <td className="px-1">
                              <button
                                onClick={() => handleRemoveRow(ri)}
                                className="flex h-5 w-5 items-center justify-center rounded text-zinc-600 hover:text-red-400"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button
                  onClick={handleAddRow}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-300"
                >
                  <Plus className="h-3 w-3" /> Add row
                </button>
              </div>

              {createError && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {createError}
                </div>
              )}

              <button
                onClick={handleCreateTable}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-500/20 transition-all hover:bg-violet-500 active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Table
              </button>
            </div>
          )}

          {/* ── Empty State ────────────────── */}
          {view !== 'create' && !selectedTable && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-500">
              <Columns className="h-10 w-10 text-zinc-700" />
              <p className="text-sm">Select a table to view its schema and data</p>
            </div>
          )}

          {/* ── Table Detail View ──────────── */}
          {view !== 'create' && selectedTable && (
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
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400">
                              Column
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400">
                              Type
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400">
                              Key
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400">
                              Nullable
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSchema.columns.map((col) => {
                            const rel = relations.find(
                              (r) => r.from === activeSchema.name && r.fromColumn === col.name,
                            );
                            return (
                              <tr
                                key={col.name}
                                className="border-b border-zinc-800/50 last:border-0"
                              >
                                <td className="px-4 py-2 font-mono text-xs text-zinc-200">
                                  {col.name}
                                </td>
                                <td className="px-4 py-2 text-xs text-zinc-400">{col.type}</td>
                                <td className="px-4 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {col.primaryKey && (
                                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                                        <KeyRound className="h-2.5 w-2.5" /> PK
                                      </span>
                                    )}
                                    {rel && (
                                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                                        <ArrowRight className="h-2.5 w-2.5" /> FK → {rel.to}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-xs text-zinc-500">
                                  {col.nullable ? 'Yes' : 'No'}
                                </td>
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
