'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/helpers';

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

export function DataGeneratorDialog({ open, onClose, onGenerate, className }: DataGeneratorDialogProps) {
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

  const handleGenerate = () => {
    onGenerate(tableName, columns, rowCount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={cn('w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Generate Table Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define columns and generate random data using Faker.js
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium">Table Name</label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium">Rows</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={rowCount}
                onChange={(e) => setRowCount(Math.min(1000, Math.max(1, Number(e.target.value))))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium">Columns</label>
              <button
                onClick={addColumn}
                className="rounded px-2 py-0.5 text-xs text-primary hover:bg-primary/10"
              >
                + Add Column
              </button>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {columns.map((col, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => updateColumn(i, { name: e.target.value })}
                    className="w-32 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                    placeholder="Column name"
                  />
                  <select
                    value={col.type}
                    onChange={(e) => updateColumn(i, { type: e.target.value as ColumnDef['type'] })}
                    className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                  >
                    <option value="integer">INTEGER</option>
                    <option value="text">TEXT</option>
                    <option value="real">REAL</option>
                    <option value="date">DATE</option>
                    <option value="boolean">BOOLEAN</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={col.primaryKey}
                      onChange={(e) => updateColumn(i, { primaryKey: e.target.checked })}
                    />
                    PK
                  </label>
                  <button
                    onClick={() => removeColumn(i)}
                    className="text-xs text-red-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
