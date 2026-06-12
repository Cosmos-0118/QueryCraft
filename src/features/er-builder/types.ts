export interface EREntity {
  id: string;
  name: string;
  isWeak: boolean;
  position: { x: number; y: number };
}

export type AttributeKind = 'regular' | 'key' | 'multivalued' | 'derived' | 'composite';

export interface ERAttribute {
  id: string;
  name: string;
  kind: AttributeKind;
  entityId: string;
  position: { x: number; y: number };
}

export type Cardinality = '1:1' | '1:N' | 'M:N';

export interface ERRelationship {
  id: string;
  name: string;
  cardinality: Cardinality;
  entities: [string, string];
  position: { x: number; y: number };
}

export interface ERDiagram {
  entities: EREntity[];
  attributes: ERAttribute[];
  relationships: ERRelationship[];
}
