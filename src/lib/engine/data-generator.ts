import { faker } from '@faker-js/faker';

interface ColumnDef {
  name: string;
  type: 'integer' | 'text' | 'real' | 'date' | 'boolean';
  primaryKey?: boolean;
}

export function generateCreateTable(tableName: string, columns: ColumnDef[]): string {
  const colDefs = columns.map((c) => {
    const sqlType =
      c.type === 'integer'
        ? 'INTEGER'
        : c.type === 'real'
          ? 'REAL'
          : c.type === 'date'
            ? 'TEXT'
            : c.type === 'boolean'
              ? 'INTEGER'
              : 'TEXT';
    return `"${c.name}" ${sqlType}${c.primaryKey ? ' PRIMARY KEY' : ''}`;
  });
  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs.join(', ')});`;
}

export function generateInserts(tableName: string, columns: ColumnDef[], rowCount: number): string {
  const rows: string[] = [];
  for (let i = 0; i < rowCount; i++) {
    const values = columns.map((c) => {
      if (c.primaryKey && c.type === 'integer') return String(i + 1);
      return `'${generateValue(c.type).replace(/'/g, "''")}'`;
    });
    rows.push(`INSERT INTO "${tableName}" VALUES (${values.join(', ')});`);
  }
  return rows.join('\n');
}

function generateValue(type: string): string {
  switch (type) {
    case 'integer':
      return String(faker.number.int({ min: 1, max: 10000 }));
    case 'real':
      return faker.number.float({ min: 0, max: 100000, fractionDigits: 2 }).toString();
    case 'date':
      return faker.date.past({ years: 5 }).toISOString().split('T')[0];
    case 'boolean':
      return faker.datatype.boolean() ? '1' : '0';
    default:
      return faker.person.fullName();
  }
}

export function generateSampleDataSQL(
  tableName: string,
  columns: ColumnDef[],
  rowCount: number,
): string {
  return [
    generateCreateTable(tableName, columns),
    generateInserts(tableName, columns, rowCount),
  ].join('\n');
}
