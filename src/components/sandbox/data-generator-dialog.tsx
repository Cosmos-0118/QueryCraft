'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/helpers';
import { X, Plus, Trash2, Sparkles, Hash, Type, ToggleLeft, ChevronDown } from 'lucide-react';

interface ColumnDef {
  name: string;
  type: 'integer' | 'text' | 'real' | 'date' | 'boolean';
  primaryKey: boolean;
}

interface DataGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (tableName: string, columns: ColumnDef[], rowCount: number) => void;
  className?: string;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { name: 'id', type: 'integer', primaryKey: true },
  { name: 'name', type: 'text', primaryKey: false },
];

const TYPE_COLORS: Record<string, string> = {
  integer: 'text-amber-400 bg-amber-500/15',
  text: 'text-blue-400 bg-blue-500/15',
  real: 'text-emerald-400 bg-emerald-500/15',
  date: 'text-cyan-400 bg-cyan-500/15',
  boolean: 'text-pink-400 bg-pink-500/15',
};

export function DataGeneratorDialog({ open, onClose, onGenerate }: DataGeneratorDialogProps) {
  const [tableName, setTableName] = useState('students');
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [rowCount, setRowCount] = useState(10);

  if (!open) return null;

  const addColumn = () => {
    setColumns([...columns, { name: `col${columns.length + 1}`, type: 'text', primaryKey: false }]);
  };

  const removeColumn = (i: number) => {
    setColumns(columns.filter((_, idx) => idx !== i));
  };

  const updateColumn = (i: number, updates: Partial<ColumnDef>) => {
    setColumns(columns.map((c, idx) => (idx === i ? { ...c, ...updates } : c)));
  };

  const cycleType = (i: number) => {
    const order: ColumnDef['type'][] = ['text', 'integer', 'real', 'date', 'boolean'];
    const cur = columns[i].type;
    const next = order[(order.indexOf(cur) + 1) % order.length];
    updateColumn(i, { type: next });
  };

  const handleGenerate = () => {
    onGenerate(tableName, columns, rowCount);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex w-[95vw] max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-900 shadow-2xl shadow-violet-500/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-violet-500/25">
              <Sparkles className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Generate Data</h2>
              <p className="text-xs text-zinc-500">Define columns and auto-generate random rows</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* Table Name + Row Count */}
          <div className="mb-5 flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                Table Name
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="w-full rounded-xl border border-zinc-700/50 bg-zinc-950/60 px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/15"
              />
            </div>
            <div className="w-24">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                Rows
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={rowCount}
                onChange={(e) => setRowCount(Math.min(1000, Math.max(1, Number(e.target.value))))}
                className="w-full rounded-xl border border-zinc-700/50 bg-zinc-950/60 px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/15"
              />
            </div>
          </div>

          {/* Columns */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <Hash className="h-3 w-3" /> Columns
            </label>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {columns.map((col, i) => {
                const TypeIcon = col.type === 'integer' ? Hash : col.type === 'real' ? ToggleLeft : Type;
                return (
                  <div
                    key={i}
                    className="group flex items-center gap-2 rounded-xl border border-zinc-800/60 bg-zinc-800/20 px-3 py-2 transition-colors hover:border-zinc-700/60"
                  >
                    <input
                      type="text"
                      value={col.name}
                      onChange={(e) => updateColumn(i, { name: e.target.value })}
                      className="flex-1 bg-transparent font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
                      placeholder="Column name"
                    />
                    <button
                      onClick={() => cycleType(i)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all',
                        TYPE_COLORS[col.type] || TYPE_COLORS.text,
                      )}
                    >
                      <TypeIcon className="h-3 w-3" />
                      {col.type.toUpperCase()}
                      <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                    </button>
                    <label className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <input
                        type="checkbox"
                        checked={col.primaryKey}
                        onChange={(e) => updateColumn(i, { primaryKey: e.target.checked })}
                        className="rounded"
                      />
                      PK
                    </label>
                    {columns.length > 1 && (
                      <button
                        onClick={() => removeColumn(i)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
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
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-all hover:bg-zinc-800/50 hover:text-violet-300"
            >
              <Plus className="h-3 w-3" /> Add Column
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-700/40 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-500/20 transition-all hover:bg-violet-500 hover:shadow-violet-500/30 active:scale-[0.98]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
