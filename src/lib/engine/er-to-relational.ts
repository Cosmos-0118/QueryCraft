import type { ERDiagram, EREntity, ERAttribute, ERRelationship } from '@/types/er-diagram';
import type { Column, TableSchema } from '@/types/database';

export function erToRelational(diagram: ERDiagram): TableSchema[] {
  const tables: TableSchema[] = [];
  const entityMap = new Map<string, EREntity>();
  const entityAttrs = new Map<string, ERAttribute[]>();

  // Index entities
  for (const entity of diagram.entities) {
    entityMap.set(entity.id, entity);
    entityAttrs.set(entity.id, []);
  }

  // Group attributes by entity
  for (const attr of diagram.attributes) {
    const list = entityAttrs.get(attr.entityId);
    if (list) list.push(attr);
  }

  // Create tables for entities
  for (const entity of diagram.entities) {
    const attrs = entityAttrs.get(entity.id) ?? [];
    const columns: Column[] = [];
    let hasPK = false;

    for (const attr of attrs) {
      if (attr.kind === 'multivalued') continue; // handled separately
      if (attr.kind === 'derived') continue; // not stored

      const col: Column = {
        name: attr.name,
        type: 'TEXT',
        nullable: attr.kind !== 'key',
        primaryKey: attr.kind === 'key',
      };
      if (attr.kind === 'key') hasPK = true;
      columns.push(col);
    }

    if (!hasPK && columns.length > 0) {
      columns[0].primaryKey = true;
      columns[0].nullable = false;
    }

    tables.push({ name: entity.name, columns });

    // Multivalued attributes get their own table
    for (const attr of attrs) {
      if (attr.kind !== 'multivalued') continue;
      const pkAttr = attrs.find((a) => a.kind === 'key');
      const fkName = pkAttr ? pkAttr.name : `${entity.name}_id`;
      tables.push({
        name: `${entity.name}_${attr.name}`,
        columns: [
          {
            name: fkName,
            type: 'TEXT',
            nullable: false,
            primaryKey: true,
            foreignKey: { table: entity.name, column: fkName },
          },
          { name: attr.name, type: 'TEXT', nullable: false, primaryKey: true },
        ],
      });
    }
  }

  // Handle relationships
  for (const rel of diagram.relationships) {
    const [e1Id, e2Id] = rel.entities;
    const e1 = entityMap.get(e1Id);
    const e2 = entityMap.get(e2Id);
    if (!e1 || !e2) continue;

    const pk1 = getPrimaryKey(e1, entityAttrs.get(e1.id) ?? []);
    const pk2 = getPrimaryKey(e2, entityAttrs.get(e2.id) ?? []);

    switch (rel.cardinality) {
      case '1:1': {
        // Add FK to either side (pick e2)
        const t = tables.find((t) => t.name === e2.name);
        if (t) {
          t.columns.push({
            name: `${e1.name}_${pk1}`,
            type: 'TEXT',
            nullable: true,
            primaryKey: false,
            foreignKey: { table: e1.name, column: pk1 },
          });
        }
        break;
      }
      case '1:N': {
        // FK goes on the N side (e2)
        const t = tables.find((t) => t.name === e2.name);
        if (t) {
          t.columns.push({
            name: `${e1.name}_${pk1}`,
            type: 'TEXT',
            nullable: true,
            primaryKey: false,
            foreignKey: { table: e1.name, column: pk1 },
          });
        }
        break;
      }
      case 'M:N': {
        // New junction table
        tables.push({
          name: `${e1.name}_${e2.name}`,
          columns: [
            {
              name: `${e1.name}_${pk1}`,
              type: 'TEXT',
              nullable: false,
              primaryKey: true,
              foreignKey: { table: e1.name, column: pk1 },
            },
            {
              name: `${e2.name}_${pk2}`,
              type: 'TEXT',
              nullable: false,
              primaryKey: true,
              foreignKey: { table: e2.name, column: pk2 },
            },
          ],
        });
        break;
      }
    }
  }

  return tables;
}

function getPrimaryKey(entity: EREntity, attrs: ERAttribute[]): string {
  const pk = attrs.find((a) => a.kind === 'key');
  return pk ? pk.name : `${entity.name}_id`;
}

// Generate CREATE TABLE SQL from schemas
export function schemasToSQL(schemas: TableSchema[]): string {
  return schemas
    .map((table) => {
      const pks = table.columns.filter((c) => c.primaryKey).map((c) => `"${c.name}"`);
      const fks = table.columns.filter((c) => c.foreignKey);

      const colDefs = table.columns.map((c) => {
        let def = `  "${c.name}" ${c.type}`;
        if (!c.nullable) def += ' NOT NULL';
        return def;
      });

      if (pks.length > 0) colDefs.push(`  PRIMARY KEY (${pks.join(', ')})`);
      for (const fk of fks) {
        colDefs.push(
          `  FOREIGN KEY ("${fk.name}") REFERENCES "${fk.foreignKey!.table}"("${fk.foreignKey!.column}")`,
        );
      }

      return `CREATE TABLE "${table.name}" (\n${colDefs.join(',\n')}\n);`;
    })
    .join('\n\n');
}
