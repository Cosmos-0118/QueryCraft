'use client';

import { useState } from 'react';
import type { FunctionalDependency } from '@/types/normalizer';
import { cn } from '@/lib/utils/helpers';

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
    const cols = colInput.split(',').map((s) => s.trim()).filter(Boolean);
    onColumnsChange(cols);
  };

  const handleAddFD = () => {
    const det = detInput.split(',').map((s) => s.trim()).filter(Boolean);
    const dep = depInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (det.length === 0 || dep.length === 0) return;
    onAdd({ determinant: det, dependent: dep });
    setDetInput('');
    setDepInput('');
  };

  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      <div className="border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Table Definition
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <label className="block text-xs font-medium">Attributes (comma-separated)</label>
          <input
            type="text"
            value={colInput}
            onChange={(e) => setColInput(e.target.value)}
            onBlur={handleColumnsBlur}
            placeholder="e.g. A, B, C, D"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-2">Functional Dependencies</label>
          {fds.length > 0 && (
            <ul className="mb-2 space-y-1">
              {fds.map((fd, i) => (
                <li key={i} className="flex items-center gap-2 rounded bg-muted px-3 py-1.5 text-sm">
                  <span className="font-mono font-semibold text-primary">{fd.determinant.join(', ')}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono">{fd.dependent.join(', ')}</span>
                  <button
                    onClick={() => onRemove(i)}
                    className="ml-auto text-xs text-red-400 hover:text-red-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground">Determinant</label>
              <input
                type="text"
                value={detInput}
                onChange={(e) => setDetInput(e.target.value)}
                placeholder="e.g. A, B"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <span className="pb-2 text-lg text-muted-foreground">→</span>
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground">Dependent</label>
              <input
                type="text"
                value={depInput}
                onChange={(e) => setDepInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFD()}
                placeholder="e.g. C"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleAddFD}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
