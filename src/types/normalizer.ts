export type NormalForm = 'UNF' | '1NF' | '2NF' | '3NF' | 'BCNF' | '4NF' | '5NF';

export interface FunctionalDependency {
  determinant: string[];
  dependent: string[];
}

export interface DecompositionStep {
  normalForm: NormalForm;
  tables: NormalizerTable[];
  explanation: string;
  anomalyFixed?: string;
}

export interface NormalizerTable {
  name: string;
  columns: string[];
  primaryKey: string[];
  functionalDependencies: FunctionalDependency[];
  sampleData?: string[][];
}

export interface Decomposition {
  originalTable: NormalizerTable;
  steps: DecompositionStep[];
  currentNormalForm: NormalForm;
  targetNormalForm: NormalForm;
}
