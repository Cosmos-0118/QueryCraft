export type StepType = 'sql' | 'algebra' | 'explanation' | 'diagram' | 'normalization';

export interface Step {
  id: string;
  type: StepType;
  title: string;
  explanation: string;
  command?: string;
  beforeState?: TableSnapshot[];
  afterState?: TableSnapshot[];
  highlightedRows?: {
    tableIndex: number;
    rowIndices: number[];
    color: 'green' | 'red' | 'yellow';
  }[];
  highlightedColumns?: { tableIndex: number; columnIndices: number[] }[];
}

export interface TableSnapshot {
  name: string;
  columns: string[];
  rows: string[][];
}

export interface Lesson {
  slug: string;
  title: string;
  description: string;
  steps: Step[];
}

export interface LessonMeta {
  slug: string;
  title: string;
  description: string;
  topicSlug: string;
  stepCount: number;
  estimatedMinutes: number;
}
