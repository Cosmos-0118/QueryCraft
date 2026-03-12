import type { Step, TableSnapshot } from '@/types/lesson';

export interface VisualStep {
  id: string;
  type: Step['type'];
  title: string;
  explanation: string;
  command?: string;
  beforeTables: TableSnapshot[];
  afterTables: TableSnapshot[];
  highlightedRows: { tableIndex: number; rowIndices: number[]; color: string }[];
  highlightedColumns: { tableIndex: number; columnIndices: number[] }[];
}

export function buildVisualStep(step: Step): VisualStep {
  return {
    id: step.id,
    type: step.type,
    title: step.title,
    explanation: step.explanation,
    command: step.command,
    beforeTables: step.beforeState ?? [],
    afterTables: step.afterState ?? [],
    highlightedRows: step.highlightedRows ?? [],
    highlightedColumns: step.highlightedColumns ?? [],
  };
}

export function buildVisualSteps(steps: Step[]): VisualStep[] {
  return steps.map(buildVisualStep);
}

export function snapshotToRecords(snapshot: TableSnapshot): {
  columns: string[];
  rows: Record<string, string>[];
} {
  return {
    columns: snapshot.columns,
    rows: snapshot.rows.map((row) => {
      const record: Record<string, string> = {};
      snapshot.columns.forEach((col, i) => {
        record[col] = row[i] ?? '';
      });
      return record;
    }),
  };
}
