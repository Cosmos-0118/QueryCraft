'use client';

import { useState, useCallback } from 'react';
import type { QueryResult } from '@/types/database';
import { cn } from '@/lib/utils/helpers';
import {
  X,
  Plus,
  Trash2,
  Table2,
  KeyRound,
  Type,
  Hash,
  ToggleLeft,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface CreateTableModalProps {
  open: boolean;
  onClose: () => void;
  execute: (sql: string) => QueryResult;
  onCreated: () => void;
}

type ColType = 'TEXT' | 'INTEGER' | 'REAL';

interface ColDef {
  id: number;
  name: string;
  type: ColType;
  pk: boolean;
}

const TYPE_META: Record<ColType, { icon: typeof Type; color: string; label: string }> = {
  TEXT: { icon: Type, color: 'text-blue-400 bg-blue-500/15', label: 'Text' },
  INTEGER: { icon: Hash, color: 'text-amber-400 bg-amber-500/15', label: 'Integer' },
  REAL: { icon: ToggleLeft, color: 'text-emerald-400 bg-emerald-500/15', label: 'Real' },
};

let colId = 1;

export function CreateTableModal({ open, onClose, execute, onCreated }: CreateTableModalProps) {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColDef[]>([
    { id: colId++, name: 'id', type: 'INTEGER', pk: true },
    { id: colId++, name: '', type: 'TEXT', pk: false },
  ]);
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validCols = columns.filter((c) => c.name.trim());

  const reset = useCallback(() => {
    colId = 1;
    setTableName('');
    setColumns([
      { id: colId++, name: 'id', type: 'INTEGER', pk: true },
      { id: colId++, name: '', type: 'TEXT', pk: false },
    ]);
    setRows([]);
    setError(null);
    setSuccess(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const addColumn = useCallback(() => {
    setColumns((prev) => [...prev, { id: colId++, name: '', type: 'TEXT', pk: false }]);
  }, []);

  const removeColumn = useCallback((id: number) => {
    setColumns((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const next = prev.filter((c) => c.id !== id);
      setRows((r) => r.map((row) => row.filter((_, i) => i !== idx)));
      return next;
    });
  }, []);

  const updateColumn = useCallback((id: number, field: keyof ColDef, value: string | boolean) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }, []);

  const cycleType = useCallback((id: number) => {
    const order: ColType[] = ['TEXT', 'INTEGER', 'REAL'];
    setColumns((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = order[(order.indexOf(c.type) + 1) % order.length];
        return { ...c, type: next };
      }),
    );
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, columns.map(() => '')]);
  }, [columns]);

  const updateCell = useCallback((ri: number, ci: number, value: string) => {
    setRows((prev) =>
      prev.map((row, r) => (r === ri ? row.map((cell, c) => (c === ci ? value : cell)) : row)),
    );
  }, []);

  const removeRow = useCallback((ri: number) => {
    setRows((prev) => prev.filter((_, i) => i !== ri));
  }, []);

  const handleCreate = useCallback(() => {
    setError(null);
    const name = tableName.trim();
    if (!name) { setError('Give your table a name'); return; }
    if (!/^[a-zA-Z_]\w*$/.test(name)) { setError('Use only letters, digits, and underscores (start with a letter)'); return; }
    if (validCols.length === 0) { setError('Add at least one named column'); return; }

    const colDefs = validCols
      .map((c) => {
        let def = `"${c.name.trim()}" ${c.type}`;
        if (c.pk) def += ' PRIMARY KEY';
        return def;
      })
      .join(', ');

    const result = execute(`CREATE TABLE "${name}" (${colDefs})`);
    if (result.error) { setError(result.error); return; }

    for (const row of rows) {
      const vals = validCols.map((c) => {
        const colIdx = columns.indexOf(c);
        const v = row[colIdx]?.trim() ?? '';
        if (!v) return 'NULL';
        if (c.type === 'INTEGER') return String(parseInt(v, 10) || 0);
        if (c.type === 'REAL') return String(parseFloat(v) || 0);
        return `'${v.replace(/'/g, "''")}'`;
      });
      const ins = execute(`INSERT INTO "${name}" VALUES (${vals.join(', ')})`);
      if (ins.error) { setError(ins.error); return; }
    }

    setSuccess(true);
    onCreated();
    setTimeout(() => handleClose(), 800);
  }, [tableName, validCols, columns, rows, execute, onCreated, handleClose]);

  if (!open) return null;

  return (
    <div
      className="qc-sandbox-overlay fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleClose}
    >
      <div
        data-tone="violet"
        className="qc-sandbox-dialog relative flex w-[95vw] max-w-2xl flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--sandbox-border-soft)' }}>
          <div className="flex items-center gap-3">
            <div data-tone="violet" className="qc-sandbox-dialog-badge flex h-9 w-9 items-center justify-center rounded-xl">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Create Table</h2>
              <p className="text-xs text-muted-foreground/80">Define columns, add data, done</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="qc-sandbox-btn qc-sandbox-btn-neutral flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* Table Name */}
          <div className="mb-5">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Table2 className="h-3 w-3" /> Table Name
            </label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="employees"
              autoFocus
              className="qc-sandbox-textarea w-full rounded-xl px-4 py-2.5 text-sm"
            />
          </div>

          {/* Columns */}
          <div className="mb-5">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Columns
            </label>
            <div className="space-y-2">
              {columns.map((col, idx) => {
                const meta = TYPE_META[col.type];
                const Icon = meta.icon;
                return (
                  <div
                    key={col.id}
                    className="qc-sandbox-list-item group flex items-center gap-2 rounded-xl px-3 py-2 transition-colors"
                  >
                    {/* Name */}
                    <input
                      type="text"
                      value={col.name}
                      onChange={(e) => updateColumn(col.id, 'name', e.target.value)}
                      placeholder={`column_${idx + 1}`}
                      className="flex-1 bg-transparent font-mono text-sm text-foreground/90 outline-none placeholder:text-muted-foreground"
                    />

                    {/* Type chip — click to cycle */}
                    <button
                      onClick={() => cycleType(col.id)}
                      title="Click to change type"
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all',
                        meta.color,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                      <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                    </button>

                    {/* PK toggle */}
                    <button
                      onClick={() => updateColumn(col.id, 'pk', !col.pk)}
                      title="Toggle Primary Key"
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all',
                        col.pk
                          ? 'qc-sandbox-dialog-badge'
                          : 'qc-sandbox-chip-muted',
                      )}
                      data-tone={col.pk ? 'amber' : undefined}
                    >
                      <KeyRound className="h-3 w-3" />
                      PK
                    </button>

                    {/* Delete */}
                    {columns.length > 1 && (
                      <button
                        onClick={() => removeColumn(col.id)}
                        className="qc-sandbox-btn qc-sandbox-btn-neutral flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={addColumn}
              data-tone="violet"
              className="qc-sandbox-btn qc-sandbox-btn-tone mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              <Plus className="h-3 w-3" /> Add Column
            </button>
          </div>

          {/* Data Rows */}
          <div className="mb-4">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Hash className="h-3 w-3" /> Data
              <span className="text-muted-foreground">(optional)</span>
            </label>

            {rows.length > 0 && (
              <div className="qc-sandbox-code-block mb-2 overflow-x-auto rounded-xl">
                <table className="w-full min-w-[400px] text-xs">
                  <thead>
                    <tr
                      className="border-b"
                      style={{
                        borderColor: 'var(--sandbox-border-soft)',
                        background: 'color-mix(in oklab, var(--sandbox-surface-soft) 82%, transparent)',
                      }}
                    >
                      {columns.map((c, ci) => (
                        <th
                          key={ci}
                          className="px-3 py-2 text-left font-mono text-[11px] font-medium text-muted-foreground/80"
                        >
                          {c.name || `col_${ci + 1}`}
                          <span className={cn('ml-1 text-[9px]', TYPE_META[c.type].color.split(' ')[0])}>
                            {c.type}
                          </span>
                        </th>
                      ))}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="group border-b last:border-0 transition-colors"
                        style={{ borderColor: 'var(--sandbox-border-soft)' }}
                      >
                        {columns.map((_, ci) => (
                          <td key={ci} className="px-1.5 py-1">
                            <input
                              type="text"
                              value={row[ci] ?? ''}
                              onChange={(e) => updateCell(ri, ci, e.target.value)}
                              placeholder="—"
                              className="w-full min-w-[70px] rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-foreground/80 outline-none placeholder:text-muted-foreground/80"
                            />
                          </td>
                        ))}
                        <td className="px-1">
                          <button
                            onClick={() => removeRow(ri)}
                            className="qc-sandbox-btn qc-sandbox-btn-neutral flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-all group-hover:opacity-100"
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
              onClick={addRow}
              data-tone="violet"
              className="qc-sandbox-btn qc-sandbox-btn-tone inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              <Plus className="h-3 w-3" /> Add Row
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-4 rounded-xl border px-4 py-2.5 text-xs"
              style={{
                borderColor: 'var(--sandbox-error-border)',
                background: 'var(--sandbox-error-bg)',
                color: 'var(--sandbox-error-fg)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: 'var(--sandbox-border-soft)' }}>
          <button
            onClick={handleClose}
            className="qc-sandbox-btn qc-sandbox-btn-neutral rounded-lg px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={success}
            data-tone={success ? 'emerald' : 'violet'}
            className="qc-sandbox-btn qc-sandbox-btn-tone inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all active:scale-[0.98]"
          >
            {success ? (
              <>✓ Created</>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Create Table
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
