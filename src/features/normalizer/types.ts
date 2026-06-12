/**
 * Supported normal forms for the normalization workflow.
 */
export type NormalForm = 'UNF' | '1NF' | '2NF' | '3NF' | 'BCNF' | '4NF' | '5NF';

/**
 * Functional dependency in the form determinant -> dependent.
 */
export interface FunctionalDependency {
  determinant: string[];
  dependent: string[];
}

/**
 * Multivalued dependency in the form determinant ->> dependent.
 */
export interface MultivaluedDependency {
  determinant: string[];
  dependent: string[];
}

/**
 * Join dependency represented as projection components.
 */
export interface JoinDependency {
  components: string[][];
}

/**
 * Column metadata used by the normalizer table schema.
 */
export interface Column {
  name: string;
  type?: string;
  isKey: boolean;
}

/**
 * Foreign-key relationship between tables.
 */
export interface ForeignKey {
  columns: string[];
  referencesTable: string;
  referencesColumns: string[];
}

/**
 * Input or output relational table handled by the normalization engine.
 */
export interface TableSchema {
  id: string;
  name: string;
  columns: Column[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
  fds: FunctionalDependency[];
  mvds: MultivaluedDependency[];
  joinDependencies?: JoinDependency[];
  sampleData?: string[][];
}

/**
 * Types of normalization violations discovered during analysis.
 */
export type ViolationType = 'partial' | 'transitive' | 'bcnf' | 'mvd' | 'jd';

/**
 * Violation descriptor reported for a normalization step.
 */
export interface Violation {
  type: ViolationType;
  determinant: string[];
  dependent: string[];
  explanation: string;
}

/**
 * Human-readable anomaly examples for a decomposition step.
 */
export interface AnomalyDemo {
  insertAnomaly?: string;
  deleteAnomaly?: string;
  updateAnomaly?: string;
}

/**
 * One transition in the normalization workflow (for example 2NF -> 3NF).
 */
export interface NormalizationStep {
  fromNF: NormalForm;
  toNF: NormalForm;
  inputTables: TableSchema[];
  outputTables: TableSchema[];
  explanation: string;
  violationsFound: Violation[];
  anomalyDemo?: AnomalyDemo;
}

/**
 * Full output from running normalization to a target normal form.
 */
export interface NormalizationResult {
  steps: NormalizationStep[];
  detectedNF: NormalForm;
  targetNF: NormalForm;
  originalTable: TableSchema;
}
