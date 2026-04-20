'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils/helpers';
import { Plus, Table2, Trash2 } from 'lucide-react';

interface UNFTableEditorProps {
  tableName: string;
  columns: string[];
  rows: string[][];
  onTableNameChange: (name: string) => void;
  onColumnsChange: (columns: string[]) => void;
  onRowsChange: (rows: string[][]) => void;
  className?: string;
}

function normalizeRow(row: string[], columnCount: number): string[] {
  if (columnCount <= 0) return [];
  if (row.length === columnCount) return row;
  if (row.length > columnCount) return row.slice(0, columnCount);
  return [...row, ...Array.from({ length: columnCount - row.length }, () => '')];
}

export function UNFTableEditor({
  tableName,
  columns,
  rows,
  onTableNameChange,
  onColumnsChange,
  onRowsChange,
  className,
}: UNFTableEditorProps) {
  const [columnInput, setColumnInput] = useState(columns.join(', '));

  useEffect(() => {
    setColumnInput(columns.join(', '));
  }, [columns]);

  const normalizedRows = useMemo(() => {
    if (columns.length === 0) return [];
    return rows.map((row) => normalizeRow(row, columns.length));
  }, [columns, rows]);

  useEffect(() => {
    if (columns.length === 0) return;
    const needsSync = normalizedRows.some((row, index) => {
      const original = rows[index] ?? [];
      if (row.length !== original.length) return true;
      return row.some((value, colIndex) => value !== original[colIndex]);
    });
    if (needsSync) {
      onRowsChange(normalizedRows);
    }
  }, [columns.length, normalizedRows, onRowsChange, rows]);

  const handleColumnsCommit = () => {
    const parsedColumns = columnInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    onColumnsChange(parsedColumns);
  };

  const handleAddRow = () => {
    if (columns.length === 0) return;
    onRowsChange([...normalizedRows, Array.from({ length: columns.length }, () => '')]);
  };

  const handleRemoveRow = (rowIndex: number) => {
    onRowsChange(normalizedRows.filter((_, index) => index !== rowIndex));
  };

  const handleCellChange = (rowIndex: number, columnIndex: number, value: string) => {
    const nextRows = [...normalizedRows];
    const targetRow = [...nextRows[rowIndex]];
    targetRow[columnIndex] = value;
    nextRows[rowIndex] = targetRow;
    onRowsChange(nextRows);
  };

  return (
    <div className={cn('rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <Table2 className="h-3.5 w-3.5 text-cyan-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          UNF Table Builder
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Table Name
            </label>
            <input
              type="text"
              value={tableName}
              onChange={(event) => onTableNameChange(event.target.value)}
              placeholder="e.g. EnrollmentUNF"
              className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-2 font-mono text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Attributes
            </label>
            <input
              type="text"
              value={columnInput}
              onChange={(event) => setColumnInput(event.target.value)}
              onBlur={handleColumnsCommit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleColumnsCommit();
                }
              }}
              placeholder="e.g. student_id, course_id, grade"
              className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-2 font-mono text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Row Values</div>
            <button
              type="button"
              onClick={handleAddRow}
              disabled={columns.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700/40 disabled:bg-zinc-800/40 disabled:text-zinc-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </button>
          </div>

          {columns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-700/50 bg-zinc-800/20 px-4 py-5 text-center text-xs text-zinc-500">
              Add attributes first to start entering values.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800/50">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr className="border-b border-zinc-800/50 bg-zinc-800/30">
                    <th className="w-12 px-2 py-2 text-left text-[10px] uppercase tracking-wider text-zinc-600">#</th>
                    {columns.map((column) => (
                      <th
                        key={column}
                        className="px-2 py-2 text-left font-mono text-[11px] font-semibold text-zinc-400"
                      >
                        {column}
                      </th>
                    ))}
                    <th className="w-12 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {normalizedRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 2} className="px-3 py-6 text-center text-zinc-600">
                        No rows yet. Use Add Row to enter sample UNF values.
                      </td>
                    </tr>
                  ) : (
                    normalizedRows.map((row, rowIndex) => (
                      <tr
                        key={`${rowIndex}-${columns.length}`}
                        className="border-b border-zinc-800/35 last:border-b-0 hover:bg-zinc-800/20"
                      >
                        <td className="px-2 py-1.5 text-center text-[10px] text-zinc-600">{rowIndex + 1}</td>
                        {row.map((cell, columnIndex) => (
                          <td key={`${rowIndex}-${columnIndex}`} className="px-1 py-1.5">
                            <input
                              type="text"
                              value={cell}
                              onChange={(event) =>
                                handleCellChange(rowIndex, columnIndex, event.target.value)
                              }
                              placeholder="value"
                              className="w-full rounded-md border border-zinc-700/60 bg-zinc-800/50 px-2 py-1 font-mono text-[11px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-cyan-500/40"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(rowIndex)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            aria-label={`Delete row ${rowIndex + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
