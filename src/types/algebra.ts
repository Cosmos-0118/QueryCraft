export type AlgebraOperationType =
  | 'selection'
  | 'projection'
  | 'union'
  | 'intersection'
  | 'difference'
  | 'cartesian'
  | 'rename'
  | 'theta_join'
  | 'equi_join'
  | 'natural_join'
  | 'left_outer_join'
  | 'right_outer_join'
  | 'full_outer_join'
  | 'semi_join'
  | 'anti_join'
  | 'division'
  | 'aggregation'
  | 'sort'
  | 'relation';

export interface AlgebraNode {
  id: string;
  operation: AlgebraOperationType;
  label: string;
  condition?: string;
  columns?: string[];
  newName?: string;
  relationName?: string;
  groupColumns?: string[];
  aggregates?: { func: string; col: string; alias: string }[];
  sortColumns?: { col: string; dir: 'ASC' | 'DESC' }[];
  children: AlgebraNode[];
}

export type AlgebraExpression = AlgebraNode;
