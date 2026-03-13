'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/helpers';
import { Plus, Pencil, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';

interface AnomalyDemoProps {
  tableName: string;
  columns: string[];
  primaryKey: string[];
  className?: string;
}

const ANOMALY_TYPES = [
  {
    key: 'insert',
    label: 'Insertion',
    icon: Plus,
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
  },
  {
    key: 'update',
    label: 'Update',
    icon: Pencil,
    color: 'text-blue-400',
    activeBg: 'bg-blue-500/10 border-blue-500/25 text-blue-300',
  },
  {
    key: 'delete',
    label: 'Deletion',
    icon: Trash2,
    color: 'text-red-400',
    activeBg: 'bg-red-500/10 border-red-500/25 text-red-300',
  },
] as const;

const EXPLANATIONS: Record<string, string> = {
  insert:
    'Insertion Anomaly: Cannot store information about a new entity without also having data for all other attributes in the table (e.g., adding a new department requires a student).',
  update:
    'Update Anomaly: If data is duplicated across rows, updating one occurrence without updating all others leads to inconsistency.',
  delete:
    'Deletion Anomaly: Deleting a row may unintentionally remove information about another entity (e.g., deleting the last student in a department loses the department info).',
};

export function AnomalyDemo({
  tableName,
  columns,
  primaryKey,
  className,
}: AnomalyDemoProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className={cn('rounded-2xl border border-zinc-700/50 bg-zinc-900/60', className)}>
      <div className="flex items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-3 sm:px-5">
        <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Anomaly Demo
        </span>
        <span className="ml-1 text-[10px] text-zinc-600">— {tableName}</span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        {/* Anomaly type buttons */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ANOMALY_TYPES.map((a) => {
            const Icon = a.icon;
            const isActive = selected === a.key;
            return (
              <button
                key={a.key}
                onClick={() => setSelected(isActive ? null : a.key)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium transition-all duration-150',
                  isActive
                    ? a.activeBg
                    : 'border-zinc-700/50 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300',
                )}
              >
                <Icon className="h-3 w-3" />
                {a.label}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {selected ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              {EXPLANATIONS[selected]}
            </p>
            <div className="mt-2.5 flex items-center gap-2 text-[10px] text-zinc-500">
              <span>
                Table:{' '}
                <span className="font-mono font-bold text-zinc-400">{tableName}</span>
              </span>
              <span className="text-zinc-700">·</span>
              <span>
                PK:{' '}
                <span className="font-mono font-bold text-amber-400/70">
                  {primaryKey.join(', ')}
                </span>
              </span>
              <span className="text-zinc-700">·</span>
              <span>{columns.length} attributes</span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/20 px-3 py-2.5 text-xs text-zinc-500">
            Pick an anomaly type above to see why this table design can fail in practice.
          </div>
        )}
      </div>
    </div>
  );
}
