'use client';

import { useState } from 'react';
import type { FunctionalDependency } from '@/types/normalizer';
import { cn } from '@/lib/utils/helpers';
import { Plus, X, Table2, ArrowRight } from 'lucide-react';

interface FDInputProps {
  columns: string[];
  fds: FunctionalDependency[];
  onAdd: (fd: FunctionalDependency) => void;
  onRemove: (index: number) => void;
  onColumnsChange: (columns: string[]) => void;
  className?: string;
}

export function FDInput({ columns, fds, onAdd, onRemove, onColumnsChange, className }: FDInputProps) {
  const [colInput, setColInput] = useState(columns.join(', '));
  const [detInput, setDetInput] = useState('');
  const [depInput, setDepInput] = useState('');

  const handleColumnsBlur = () => {
    const cols = colInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onColumnsChange(cols);
  };

  const handleAddFD = () => {
    const det = detInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const dep = depInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (det.length === 0 || dep.length === 0) return;
    onAdd({ determinant: det, dependent: dep });
    setDetInput('');
    setDepInput('');
  };

  return (
    <div className={cn('rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <Table2 className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Table Definition
        </span>
      </div>
      <div className="space-y-4 p-4">
        {/* Attributes input */}
        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Attributes
          </label>
          <input
            type="text"
            value={colInput}
            onChange={(e) => setColInput(e.target.value)}
            onBlur={handleColumnsBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleColumnsBlur()}
            placeholder="e.g. student_id, course_id, grade, dept"
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-2 font-mono text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
          />
          {columns.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {columns.map((col) => (
                <span
                  key={col}
                  className="rounded-md border border-zinc-700/40 bg-zinc-800/50 px-2 py-0.5 font-mono text-[11px] text-zinc-400"
                >
                  {col}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Functional Dependencies list */}
        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Functional Dependencies
            {fds.length > 0 && (
              <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                {fds.length}
              </span>
            )}
          </label>
          {fds.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {fds.map((fd, i) => (
                <li
                  key={i}
                  className="group flex items-center gap-2 rounded-lg border border-zinc-800/40 bg-zinc-800/20 px-3 py-2 transition-colors hover:bg-zinc-800/40"
                >
                  <span className="font-mono text-xs font-bold text-amber-400">
                    {fd.determinant.join(', ')}
                  </span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-zinc-600" />
                  <span className="font-mono text-xs text-zinc-300">
                    {fd.dependent.join(', ')}
                  </span>
                  <button
                    onClick={() => onRemove(i)}
                    className="ml-auto flex h-5 w-5 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add FD row */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] text-zinc-600">Determinant</label>
              <input
                type="text"
                value={detInput}
                onChange={(e) => setDetInput(e.target.value)}
                placeholder="e.g. A, B"
                className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-1.5 font-mono text-xs text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/40"
              />
            </div>
            <ArrowRight className="mb-2 h-4 w-4 shrink-0 text-zinc-600" />
            <div className="flex-1">
              <label className="mb-1 block text-[10px] text-zinc-600">Dependent</label>
              <input
                type="text"
                value={depInput}
                onChange={(e) => setDepInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFD()}
                placeholder="e.g. C"
                className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-1.5 font-mono text-xs text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/40"
              />
            </div>
            <button
              onClick={handleAddFD}
              className="flex h-[30px] items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 text-[11px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/25"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
