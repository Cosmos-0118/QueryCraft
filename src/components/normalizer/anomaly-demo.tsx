'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/helpers';

interface AnomalyDemoProps {
  tableName: string;
  columns: string[];
  primaryKey: string[];
  className?: string;
}

const ANOMALY_TYPES = [
  { key: 'insert', label: 'Insertion', icon: '➕', color: 'text-green-500' },
  { key: 'update', label: 'Update', icon: '✏️', color: 'text-blue-500' },
  { key: 'delete', label: 'Deletion', icon: '🗑️', color: 'text-red-500' },
] as const;

const EXPLANATIONS: Record<string, string> = {
  insert: 'Insertion Anomaly: Cannot store information about a new entity without also having data for all other attributes in the table (e.g., adding a new department requires a student).',
  update: 'Update Anomaly: If data is duplicated across rows, updating one occurrence without updating all others leads to inconsistency.',
  delete: 'Deletion Anomaly: Deleting a row may unintentionally remove information about another entity (e.g., deleting the last student in a department loses the department info).',
};

export function AnomalyDemo({ tableName, columns, primaryKey, className }: AnomalyDemoProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      <div className="border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Anomaly Demo — {tableName}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          {ANOMALY_TYPES.map((a) => (
            <button
              key={a.key}
              onClick={() => setSelected(selected === a.key ? null : a.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                selected === a.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted',
              )}
            >
              <span>{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>

        {selected && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium text-amber-600">⚠️ {EXPLANATIONS[selected]}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Table: <span className="font-mono font-bold">{tableName}</span>({columns.join(', ')}) — 
              PK: {primaryKey.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
