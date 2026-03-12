'use client';

import type { FunctionalDependency } from '@/types/normalizer';
import { cn } from '@/lib/utils/helpers';
import { GitBranch, MoveRight } from 'lucide-react';

interface DependencyDiagramProps {
  columns: string[];
  fds: FunctionalDependency[];
  className?: string;
}

const FD_THEMES = [
  { bg: 'bg-amber-500/8', border: 'border-amber-500/20', det: 'bg-amber-500/15 text-amber-300 border-amber-500/30', dep: 'bg-amber-500/8 text-amber-400/80 border-amber-500/20', arrow: 'text-amber-500', label: 'bg-amber-500/10 text-amber-400', dot: 'bg-amber-400' },
  { bg: 'bg-violet-500/8', border: 'border-violet-500/20', det: 'bg-violet-500/15 text-violet-300 border-violet-500/30', dep: 'bg-violet-500/8 text-violet-400/80 border-violet-500/20', arrow: 'text-violet-500', label: 'bg-violet-500/10 text-violet-400', dot: 'bg-violet-400' },
  { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', det: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dep: 'bg-emerald-500/8 text-emerald-400/80 border-emerald-500/20', arrow: 'text-emerald-500', label: 'bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-400' },
  { bg: 'bg-rose-500/8', border: 'border-rose-500/20', det: 'bg-rose-500/15 text-rose-300 border-rose-500/30', dep: 'bg-rose-500/8 text-rose-400/80 border-rose-500/20', arrow: 'text-rose-500', label: 'bg-rose-500/10 text-rose-400', dot: 'bg-rose-400' },
  { bg: 'bg-cyan-500/8', border: 'border-cyan-500/20', det: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', dep: 'bg-cyan-500/8 text-cyan-400/80 border-cyan-500/20', arrow: 'text-cyan-500', label: 'bg-cyan-500/10 text-cyan-400', dot: 'bg-cyan-400' },
  { bg: 'bg-pink-500/8', border: 'border-pink-500/20', det: 'bg-pink-500/15 text-pink-300 border-pink-500/30', dep: 'bg-pink-500/8 text-pink-400/80 border-pink-500/20', arrow: 'text-pink-500', label: 'bg-pink-500/10 text-pink-400', dot: 'bg-pink-400' },
];

export function DependencyDiagram({ columns, fds, className }: DependencyDiagramProps) {
  if (columns.length === 0) {
    return (
      <div className={cn('rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
        <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
          <GitBranch className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Dependency Diagram
          </span>
        </div>
        <div className="flex items-center justify-center px-4 py-12">
          <p className="text-xs text-zinc-600">Enter attributes to see the dependency graph</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <GitBranch className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Dependency Diagram
        </span>
        {fds.length > 0 && (
          <span className="ml-auto rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">
            {fds.length} FD{fds.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        {/* ── All‑attributes bar ──────────────────────── */}
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            All Attributes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {columns.map((col) => {
              // Check if this column is a determinant or dependent in any FD
              const detIn = fds.findIndex((fd) => fd.determinant.includes(col));
              const depIn = fds.findIndex((fd) => fd.dependent.includes(col));
              const theme = detIn >= 0 ? FD_THEMES[detIn % FD_THEMES.length] : depIn >= 0 ? FD_THEMES[depIn % FD_THEMES.length] : null;

              return (
                <span
                  key={col}
                  className={cn(
                    'rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors',
                    theme
                      ? 'border-zinc-700/40 bg-zinc-800/60 text-zinc-300'
                      : 'border-zinc-800/40 bg-zinc-800/30 text-zinc-500',
                  )}
                >
                  {col}
                  {/* Color dots for FDs this column is in */}
                  {(detIn >= 0 || depIn >= 0) && (
                    <span className="ml-1.5 inline-flex gap-0.5">
                      {fds.map((fd, fi) => {
                        const isDet = fd.determinant.includes(col);
                        const isDep = fd.dependent.includes(col);
                        if (!isDet && !isDep) return null;
                        const t = FD_THEMES[fi % FD_THEMES.length];
                        return (
                          <span
                            key={fi}
                            className={cn('inline-block h-1.5 w-1.5 rounded-full', t.dot)}
                            title={`FD${fi + 1}: ${isDet ? 'determinant' : 'dependent'}`}
                          />
                        );
                      })}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* ── FD cards ────────────────────────────────── */}
        {fds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800/50 px-4 py-6 text-center">
            <p className="text-xs text-zinc-600">Add functional dependencies to visualize them</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Functional Dependencies
            </div>
            {fds.map((fd, i) => {
              const theme = FD_THEMES[i % FD_THEMES.length];
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                    theme.bg,
                    theme.border,
                  )}
                >
                  {/* FD label */}
                  <span
                    className={cn(
                      'flex h-6 w-10 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
                      theme.label,
                    )}
                  >
                    FD{i + 1}
                  </span>

                  {/* Determinant chips */}
                  <div className="flex flex-wrap items-center gap-1">
                    {fd.determinant.map((col, ci) => (
                      <span key={col} className="flex items-center gap-1">
                        {ci > 0 && (
                          <span className="text-[10px] text-zinc-600">,</span>
                        )}
                        <span
                          className={cn(
                            'rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold',
                            theme.det,
                          )}
                        >
                          {col}
                        </span>
                      </span>
                    ))}
                  </div>

                  {/* Arrow */}
                  <div className={cn('flex items-center gap-0.5', theme.arrow)}>
                    <div className="h-px w-6 bg-current opacity-40" />
                    <MoveRight className="h-4 w-4" />
                  </div>

                  {/* Dependent chips */}
                  <div className="flex flex-wrap items-center gap-1">
                    {fd.dependent.map((col, ci) => (
                      <span key={col} className="flex items-center gap-1">
                        {ci > 0 && (
                          <span className="text-[10px] text-zinc-600">,</span>
                        )}
                        <span
                          className={cn(
                            'rounded-md border px-2 py-0.5 font-mono text-[11px]',
                            theme.dep,
                          )}
                        >
                          {col}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Grid view: which columns belong to which FDs ── */}
        {fds.length > 0 && columns.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Attribute × FD Matrix
            </div>
            <div className="overflow-x-auto rounded-lg border border-zinc-800/50">
              <table className="w-full min-w-[300px] text-[11px]">
                <thead>
                  <tr className="border-b border-zinc-800/50 bg-zinc-800/20">
                    <th className="px-3 py-1.5 text-left font-semibold uppercase tracking-wider text-zinc-600">
                      Attr
                    </th>
                    {fds.map((_, i) => {
                      const t = FD_THEMES[i % FD_THEMES.length];
                      return (
                        <th key={i} className="px-3 py-1.5 text-center">
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', t.label)}>
                            FD{i + 1}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => (
                    <tr
                      key={col}
                      className="border-b border-zinc-800/30 last:border-0 transition-colors hover:bg-zinc-800/15"
                    >
                      <td className="px-3 py-1.5 font-mono font-semibold text-zinc-400">
                        {col}
                      </td>
                      {fds.map((fd, fi) => {
                        const isDet = fd.determinant.includes(col);
                        const isDep = fd.dependent.includes(col);
                        const t = FD_THEMES[fi % FD_THEMES.length];
                        return (
                          <td key={fi} className="px-3 py-1.5 text-center">
                            {isDet && (
                              <span
                                className={cn(
                                  'inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold',
                                  t.det,
                                )}
                              >
                                DET
                              </span>
                            )}
                            {isDep && (
                              <span
                                className={cn(
                                  'inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px]',
                                  t.dep,
                                )}
                              >
                                DEP
                              </span>
                            )}
                            {!isDet && !isDep && (
                              <span className="text-zinc-800">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
