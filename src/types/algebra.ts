export type AlgebraOperationType =
  | 'selection'
  | 'projection'
  | 'union'
  | 'difference'
  | 'cartesian'
  | 'rename'
  | 'theta_join'
  | 'equi_join'
  | 'natural_join'
  | 'relation';

export interface AlgebraNode {
  id: string;
  operation: AlgebraOperationType;
  label: string;
  condition?: string;
  columns?: string[];
  newName?: string;
  relationName?: string;
  children: AlgebraNode[];
}

export type AlgebraExpression = AlgebraNode;
