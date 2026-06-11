import { faker } from '@faker-js/faker';

/* ── Types ──────────────────────────────────────────────── */

export type ColumnType = 'integer' | 'text' | 'real' | 'date' | 'boolean';

export type SemanticHint =
  | 'auto'
  | 'id'
  | 'register_number'
  | 'name'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'country'
  | 'zip'
  | 'company'
  | 'department'
  | 'title'
  | 'description'
  | 'url'
  | 'username'
  | 'password'
  | 'age'
  | 'salary'
  | 'price'
  | 'quantity'
  | 'balance'
  | 'gpa'
  | 'cgpa'
  | 'percentage'
  | 'rating'
  | 'credits'
  | 'semester'
  | 'grade'
  | 'year'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'gender'
  | 'status'
  | 'course_name'
  | 'subject'
  | 'building'
  | 'room_number'
  | 'isbn'
  | 'uuid';

export interface GeneratorColumnDef {
  name: string;
  type: ColumnType;
  primaryKey: boolean;
  hint: SemanticHint;
  nullable?: boolean;
  foreignKey?: { table: string; column: string };
}

export interface GeneratorTableDef {
  name: string;
  columns: GeneratorColumnDef[];
  rowCount: number;
}

/* ── Semantic Hint Detection ─────────────────────────────── */

const HINT_PATTERNS: [RegExp, SemanticHint, ColumnType][] = [
  [/^id$|_id$/i, 'id', 'integer'],
  [
    /(^|_)(ra|reg|register|registration|roll|enrollment|enrolment|admission|matric)(_|$)(no|num|number|id)($|_)/i,
    'register_number',
    'text',
  ],
  [/^(ra|reg)(no|num|number)$/i, 'register_number', 'text'],
  [/cgpa/i, 'cgpa', 'real'],
  [/\bgpa\b/i, 'gpa', 'real'],
  [/^email$|_email$/i, 'email', 'text'],
  [/^phone$|_phone$|phone_?num/i, 'phone', 'text'],
  [/first_?name/i, 'first_name', 'text'],
  [/last_?name|surname/i, 'last_name', 'text'],
  [/^name$|_name$|full_?name/i, 'name', 'text'],
  [/^username$|user_?name/i, 'username', 'text'],
  [/^password$|passwd/i, 'password', 'text'],
  [/^age$/i, 'age', 'integer'],
  [/salary|income|wage/i, 'salary', 'real'],
  [/price|cost|amount|fee/i, 'price', 'real'],
  [/balance/i, 'balance', 'real'],
  [/quantity|qty|count/i, 'quantity', 'integer'],
  [/percent/i, 'percentage', 'real'],
  [/rating|score/i, 'rating', 'real'],
  [/credits?$/i, 'credits', 'integer'],
  [/grade$/i, 'grade', 'text'],
  [/semester/i, 'semester', 'text'],
  [/year$/i, 'year', 'integer'],
  [/^date$|_date$|_at$/i, 'date', 'date'],
  [/^dob$|birth_?date|date_?of_?birth/i, 'date', 'date'],
  [/address|street/i, 'address', 'text'],
  [/^city$/i, 'city', 'text'],
  [/^country$/i, 'country', 'text'],
  [/zip|postal/i, 'zip', 'text'],
  [/company|org/i, 'company', 'text'],
  [/department|dept/i, 'department', 'text'],
  [/title$/i, 'title', 'text'],
  [/desc/i, 'description', 'text'],
  [/^url$|website|link/i, 'url', 'text'],
  [/gender|sex/i, 'gender', 'text'],
  [/status/i, 'status', 'text'],
  [/course|subject/i, 'course_name', 'text'],
  [/building|block/i, 'building', 'text'],
  [/room/i, 'room_number', 'text'],
  [/isbn/i, 'isbn', 'text'],
  [/uuid/i, 'uuid', 'text'],
  [/^(is_|has_|can_|enabled|active|verified|published)/i, 'boolean', 'boolean'],
];

function normalizeColumnName(columnName: string): string {
  return columnName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function detectHint(columnName: string): { hint: SemanticHint; suggestedType: ColumnType } {
  const normalizedName = normalizeColumnName(columnName);
  for (const [pattern, hint, type] of HINT_PATTERNS) {
    if (pattern.test(normalizedName)) {
      return { hint, suggestedType: type };
    }
  }
  return { hint: 'auto', suggestedType: 'text' };
}

function normalizeTableName(tableName: string): string {
  return normalizeColumnName(tableName);
}

function singularizeName(value: string): string {
  if (value.endsWith('ies') && value.length > 3) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith('ses') && value.length > 3) {
    return value.slice(0, -2);
  }

  if (value.endsWith('s') && !value.endsWith('ss') && value.length > 2) {
    return value.slice(0, -1);
  }

  return value;
}

function cloneTableDef(table: GeneratorTableDef): GeneratorTableDef {
  return {
    ...table,
    columns: table.columns.map((column) => ({
      ...column,
      foreignKey: column.foreignKey
        ? {
            table: column.foreignKey.table,
            column: column.foreignKey.column,
          }
        : undefined,
    })),
  };
}

function explicitPrimaryKeys(table: GeneratorTableDef): GeneratorColumnDef[] {
  return table.columns.filter((column) => column.primaryKey);
}

interface ForeignKeyCandidate {
  score: number;
  table: string;
  column: string;
}

function chooseForeignKeyCandidate(
  currentTableIndex: number,
  column: GeneratorColumnDef,
  tables: GeneratorTableDef[],
): ForeignKeyCandidate | null {
  const normalizedColumn = normalizeColumnName(column.name);
  const candidates: ForeignKeyCandidate[] = [];

  for (let index = 0; index < tables.length; index += 1) {
    if (index === currentTableIndex) continue;

    const parent = tables[index];
    const parentName = normalizeTableName(parent.name);
    const parentSingular = singularizeName(parentName);
    const parentPrimaryKeys = explicitPrimaryKeys(parent);
    if (parentPrimaryKeys.length === 0) continue;

    for (const parentPrimaryKey of parentPrimaryKeys) {
      const normalizedParentPk = normalizeColumnName(parentPrimaryKey.name);
      let score = 0;

      if (normalizedColumn === normalizedParentPk) {
        score = Math.max(score, 100);
      }

      if (normalizedParentPk === 'id' && normalizedColumn === `${parentSingular}_id`) {
        score = Math.max(score, 95);
      }

      if (normalizedParentPk === 'id' && normalizedColumn === `${parentName}_id`) {
        score = Math.max(score, 92);
      }

      if (normalizedColumn === `${parentSingular}_${normalizedParentPk}`) {
        score = Math.max(score, 82);
      }

      if (normalizedColumn === `${parentName}_${normalizedParentPk}`) {
        score = Math.max(score, 78);
      }

      if (score > 0) {
        candidates.push({
          score,
          table: parent.name,
          column: parentPrimaryKey.name,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0];

  const hasAmbiguousBest = candidates.some(
    (candidate, index) =>
      index > 0 &&
      candidate.score === best.score &&
      (candidate.table !== best.table || candidate.column !== best.column),
  );

  return hasAmbiguousBest ? null : best;
}

/**
 * Infers missing foreign keys from naming conventions and explicit parent primary keys.
 * Existing explicit foreign keys are preserved.
 */
export function inferForeignKeys(tables: GeneratorTableDef[]): GeneratorTableDef[] {
  const cloned = tables.map(cloneTableDef);

  for (let tableIndex = 0; tableIndex < cloned.length; tableIndex += 1) {
    const table = cloned[tableIndex];

    table.columns = table.columns.map((column) => {
      if (column.foreignKey) {
        return column;
      }

      const candidate = chooseForeignKeyCandidate(tableIndex, column, cloned);
      if (!candidate) {
        return column;
      }

      return {
        ...column,
        foreignKey: {
          table: candidate.table,
          column: candidate.column,
        },
      };
    });
  }

  return cloned;
}

function buildUniqueTableIndexByName(tables: GeneratorTableDef[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const table of tables) {
    const key = normalizeTableName(table.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const unique = new Map<string, number>();
  tables.forEach((table, index) => {
    const key = normalizeTableName(table.name);
    if ((counts.get(key) ?? 0) !== 1) return;
    unique.set(key, index);
  });

  return unique;
}

function orderTablesByDependencies(tables: GeneratorTableDef[]): GeneratorTableDef[] {
  if (tables.length <= 1) return [...tables];

  const nameToIndex = buildUniqueTableIndexByName(tables);
  const indegree = new Array<number>(tables.length).fill(0);
  const outgoing = new Map<number, Set<number>>();

  tables.forEach((table, childIndex) => {
    for (const column of table.columns) {
      if (!column.foreignKey) continue;
      const parentIndex = nameToIndex.get(normalizeTableName(column.foreignKey.table));
      if (parentIndex === undefined || parentIndex === childIndex) continue;

      const edges = outgoing.get(parentIndex) ?? new Set<number>();
      if (!edges.has(childIndex)) {
        edges.add(childIndex);
        outgoing.set(parentIndex, edges);
        indegree[childIndex] += 1;
      }
    }
  });

  const queue: number[] = [];
  for (let index = 0; index < indegree.length; index += 1) {
    if (indegree[index] === 0) queue.push(index);
  }

  const orderedIndexes: number[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    orderedIndexes.push(current);

    const edges = outgoing.get(current);
    if (!edges) continue;

    for (const nextIndex of edges) {
      indegree[nextIndex] -= 1;
      if (indegree[nextIndex] === 0) {
        queue.push(nextIndex);
      }
    }
  }

  if (orderedIndexes.length !== tables.length) {
    for (let index = 0; index < tables.length; index += 1) {
      if (!orderedIndexes.includes(index)) {
        orderedIndexes.push(index);
      }
    }
  }

  return orderedIndexes.map((index) => tables[index]);
}

/* ── Smart Value Generation ──────────────────────────────── */

const SEMESTERS = [
  'Fall 2023',
  'Spring 2024',
  'Fall 2024',
  'Spring 2025',
  'Fall 2025',
  'Spring 2026',
];
const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];
const STATUSES = ['active', 'inactive', 'pending', 'approved', 'rejected', 'suspended'];
const BUILDINGS = [
  'Tech Hall',
  'Science Block',
  'Arts Center',
  'Library Wing',
  'Admin Building',
  'Engineering Lab',
];
const DEPARTMENTS = [
  'Computer Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'History',
  'Economics',
];
const COURSE_NAMES = [
  'Database Systems',
  'Algorithms',
  'Data Structures',
  'Linear Algebra',
  'Calculus',
  'Operating Systems',
  'Computer Networks',
  'Software Engineering',
  'Machine Learning',
  'Discrete Mathematics',
  'Statistics',
  'Quantum Mechanics',
];

function generateRegisterNumber(rowIndex: number): string {
  const serial = String(rowIndex + 1).padStart(4, '0');
  const year = 2023 + (rowIndex % 4);
  const styles = [
    `RA${year}${serial}`,
    `RA-${year}-${serial}`,
    `REG${year}${serial}`,
    `ROLL-${year}-${serial}`,
    `ENR${year}${serial}`,
  ];
  return styles[rowIndex % styles.length];
}

function generateSmartValue(
  hint: SemanticHint,
  type: ColumnType,
  rowIndex: number,
): string | number | boolean {
  switch (hint) {
    case 'id':
      return rowIndex + 1;
    case 'register_number':
      return generateRegisterNumber(rowIndex);
    case 'name':
      return faker.person.fullName();
    case 'first_name':
      return faker.person.firstName();
    case 'last_name':
      return faker.person.lastName();
    case 'email':
      return faker.internet.email().toLowerCase();
    case 'phone':
      return faker.phone.number({ style: 'national' });
    case 'username':
      return faker.internet.username().toLowerCase();
    case 'password':
      return faker.string.alphanumeric(12);
    case 'age':
      return faker.number.int({ min: 18, max: 65 });
    case 'salary':
      return Math.round(faker.number.float({ min: 30000, max: 150000 }) / 100) * 100;
    case 'price':
      return faker.number.float({ min: 1, max: 9999, fractionDigits: 2 });
    case 'balance':
      return faker.number.float({ min: 100, max: 500000, fractionDigits: 2 });
    case 'quantity':
      return faker.number.int({ min: 1, max: 500 });
    case 'gpa':
      return Number(faker.number.float({ min: 2.0, max: 4.0, fractionDigits: 1 }).toFixed(1));
    case 'cgpa':
      return Number(faker.number.float({ min: 2.0, max: 9.9, fractionDigits: 2 }).toFixed(2));
    case 'percentage':
      return Number(faker.number.float({ min: 30, max: 100, fractionDigits: 2 }).toFixed(2));
    case 'rating':
      return Number(faker.number.float({ min: 1, max: 5, fractionDigits: 1 }).toFixed(1));
    case 'credits':
      return faker.helpers.arrayElement([1, 2, 3, 4, 5]);
    case 'grade':
      return faker.helpers.arrayElement(GRADES);
    case 'semester':
      return faker.helpers.arrayElement(SEMESTERS);
    case 'year':
      return faker.number.int({ min: 2018, max: 2026 });
    case 'date':
      return faker.date.past({ years: 5 }).toISOString().split('T')[0];
    case 'datetime':
      return faker.date.past({ years: 5 }).toISOString().replace('T', ' ').split('.')[0];
    case 'address':
      return faker.location.streetAddress();
    case 'city':
      return faker.location.city();
    case 'country':
      return faker.location.country();
    case 'zip':
      return faker.location.zipCode();
    case 'company':
      return faker.company.name();
    case 'department':
      return faker.helpers.arrayElement(DEPARTMENTS);
    case 'title':
      return faker.person.jobTitle();
    case 'description':
      return faker.lorem.sentence({ min: 5, max: 12 });
    case 'url':
      return faker.internet.url();
    case 'gender':
      return faker.helpers.arrayElement(['Male', 'Female', 'Non-binary']);
    case 'status':
      return faker.helpers.arrayElement(STATUSES);
    case 'course_name':
    case 'subject':
      return faker.helpers.arrayElement(COURSE_NAMES);
    case 'building':
      return faker.helpers.arrayElement(BUILDINGS);
    case 'room_number':
      return `${faker.helpers.arrayElement(['A', 'B', 'C', 'D'])}${faker.number.int({ min: 100, max: 499 })}`;
    case 'isbn':
      return `978-${faker.string.numeric(1)}-${faker.string.numeric(5)}-${faker.string.numeric(3)}-${faker.string.numeric(1)}`;
    case 'uuid':
      return faker.string.uuid();
    case 'boolean':
      return faker.datatype.boolean() ? 1 : 0;
    case 'auto':
    default:
      return generateFallbackValue(type);
  }
}

function generateFallbackValue(type: ColumnType): string | number {
  switch (type) {
    case 'integer':
      return faker.number.int({ min: 1, max: 10000 });
    case 'real':
      return faker.number.float({ min: 0, max: 10000, fractionDigits: 2 });
    case 'date':
      return faker.date.past({ years: 5 }).toISOString().split('T')[0];
    case 'boolean':
      return faker.datatype.boolean() ? 1 : 0;
    default:
      return faker.lorem.words({ min: 1, max: 3 });
  }
}

/* ── SQL Generation ──────────────────────────────────────── */

function sqlType(type: ColumnType): string {
  switch (type) {
    case 'integer':
      return 'INTEGER';
    case 'real':
      return 'REAL';
    case 'date':
      return 'TEXT';
    case 'boolean':
      return 'INTEGER';
    default:
      return 'TEXT';
  }
}

function escapeSQL(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  return `'${String(val).replace(/'/g, "''")}'`;
}

export function generateTableDataRows(table: GeneratorTableDef): string[][] {
  const rows: string[][] = [];

  for (let i = 0; i < table.rowCount; i++) {
    const row = table.columns.map((c) => {
      if (c.primaryKey) {
        if (c.hint === 'register_number') {
          return generateRegisterNumber(i);
        }

        if (c.hint === 'uuid') {
          return faker.string.uuid();
        }

        if (c.type === 'date') {
          const date = new Date(Date.UTC(2000, 0, 1));
          date.setUTCDate(date.getUTCDate() + i);
          return date.toISOString().split('T')[0];
        }

        if (c.type === 'text') {
          const normalized = normalizeColumnName(c.name) || 'key';
          return `${normalized}_${i + 1}`;
        }

        return String(i + 1);
      }

      const val = generateSmartValue(c.hint, c.type, i);
      return String(val ?? '');
    });

    rows.push(row);
  }

  return rows;
}

function generateRowsForResolvedTables(tables: GeneratorTableDef[]): Record<string, string[][]> {
  const rowsByTableName: Record<string, string[][]> = {};
  const rowsByNormalizedName = new Map<string, string[][]>();
  const columnsByNormalizedName = new Map<string, GeneratorColumnDef[]>();
  const uniqueTableLookup = buildUniqueTableIndexByName(tables);
  const orderedTables = orderTablesByDependencies(tables);

  const resolveForeignKeyValue = (
    column: GeneratorColumnDef,
    rowIndex: number,
  ): string | null => {
    if (!column.foreignKey) return null;

    const parentNameKey = normalizeTableName(column.foreignKey.table);
    const parentRows = rowsByNormalizedName.get(parentNameKey);
    const parentColumns = columnsByNormalizedName.get(parentNameKey);

    if (parentRows && parentRows.length > 0 && parentColumns) {
      const targetColumnIndex = parentColumns.findIndex((candidate) => candidate.name === column.foreignKey!.column);
      if (targetColumnIndex >= 0) {
        const parentRow = parentRows[rowIndex % parentRows.length];
        return parentRow[targetColumnIndex] ?? null;
      }
    }

    const parentIndex = uniqueTableLookup.get(parentNameKey);
    const parentTable = parentIndex === undefined ? null : tables[parentIndex];
    if (!parentTable || parentTable.rowCount <= 0) return null;

    const parentColumn = parentTable.columns.find((candidate) => candidate.name === column.foreignKey!.column);
    if (!parentColumn) return null;

    if (parentColumn.type === 'text') {
      const normalized = normalizeColumnName(parentColumn.name) || 'ref';
      return `${normalized}_${(rowIndex % parentTable.rowCount) + 1}`;
    }

    if (parentColumn.type === 'date') {
      const date = new Date(Date.UTC(2000, 0, 1));
      date.setUTCDate(date.getUTCDate() + (rowIndex % parentTable.rowCount));
      return date.toISOString().split('T')[0];
    }

    return String((rowIndex % parentTable.rowCount) + 1);
  };

  for (const table of orderedTables) {
    const rows: string[][] = [];

    for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
      const row = table.columns.map((column) => {
        const fkValue = resolveForeignKeyValue(column, rowIndex);
        if (fkValue !== null) {
          return fkValue;
        }

        if (column.primaryKey) {
          if (column.hint === 'register_number') {
            return generateRegisterNumber(rowIndex);
          }

          if (column.hint === 'uuid') {
            return faker.string.uuid();
          }

          if (column.type === 'date') {
            const date = new Date(Date.UTC(2000, 0, 1));
            date.setUTCDate(date.getUTCDate() + rowIndex);
            return date.toISOString().split('T')[0];
          }

          if (column.type === 'text') {
            const normalized = normalizeColumnName(column.name) || 'key';
            return `${normalized}_${rowIndex + 1}`;
          }

          return String(rowIndex + 1);
        }

        const value = generateSmartValue(column.hint, column.type, rowIndex);
        return String(value ?? '');
      });

      rows.push(row);
    }

    rowsByTableName[table.name] = rows;
    rowsByNormalizedName.set(normalizeTableName(table.name), rows);
    columnsByNormalizedName.set(normalizeTableName(table.name), table.columns);
  }

  return rowsByTableName;
}

/**
 * Generates sample rows for a set of tables while honoring explicit and inferred foreign keys.
 */
export function generateMultiTableDataRows(tables: GeneratorTableDef[]): Record<string, string[][]> {
  const resolvedTables = inferForeignKeys(tables);
  return generateRowsForResolvedTables(resolvedTables);
}

export function generateTableSQL(table: GeneratorTableDef, precomputedRows?: string[][]): string {
  const lines: string[] = [];

  // CREATE TABLE
  const colDefs = table.columns.map((c) => {
    let def = `  "${c.name}" ${sqlType(c.type)}`;
    if (c.primaryKey) def += ' PRIMARY KEY';
    if (c.nullable === false && !c.primaryKey) def += ' NOT NULL';
    return def;
  });

  const fks = table.columns.filter((c) => c.foreignKey);
  for (const fk of fks) {
    colDefs.push(
      `  FOREIGN KEY ("${fk.name}") REFERENCES "${fk.foreignKey!.table}"("${fk.foreignKey!.column}")`,
    );
  }

  lines.push(`CREATE TABLE IF NOT EXISTS "${table.name}" (`);
  lines.push(colDefs.join(',\n'));
  lines.push(');');
  lines.push('');

  // INSERT statements
  const rows = precomputedRows ?? generateTableDataRows(table);
  for (const row of rows) {
    const values = row.map((value, index) => {
      const column = table.columns[index];
      if (!column) return escapeSQL(value);

      if ((column.type === 'integer' || column.type === 'real' || column.type === 'boolean') && value !== '') {
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) {
          return escapeSQL(numeric);
        }
      }

      return escapeSQL(value);
    });
    lines.push(`INSERT INTO "${table.name}" VALUES (${values.join(', ')});`);
  }

  return lines.join('\n');
}

export function generateMultiTableSQL(tables: GeneratorTableDef[]): string {
  const resolvedTables = inferForeignKeys(tables);
  const rowsByTable = generateRowsForResolvedTables(resolvedTables);
  const orderedTables = orderTablesByDependencies(resolvedTables);

  return orderedTables
    .map((table) => generateTableSQL(table, rowsByTable[table.name]))
    .join('\n\n');
}

/* ── Template Presets ─────────────────────────────────────── */

export interface TableTemplate {
  name: string;
  label: string;
  description: string;
  tables: GeneratorTableDef[];
}

export const TABLE_TEMPLATES: TableTemplate[] = [
  {
    name: 'students',
    label: 'Students',
    description: 'Student records with GPA, department, and enrollment info',
    tables: [
      {
        name: 'students',
        rowCount: 15,
        columns: [
          { name: 'id', type: 'integer', primaryKey: true, hint: 'id' },
          { name: 'register_no', type: 'text', primaryKey: false, hint: 'register_number' },
          { name: 'name', type: 'text', primaryKey: false, hint: 'name' },
          { name: 'email', type: 'text', primaryKey: false, hint: 'email' },
          { name: 'age', type: 'integer', primaryKey: false, hint: 'age' },
          { name: 'cgpa', type: 'real', primaryKey: false, hint: 'cgpa' },
          { name: 'department', type: 'text', primaryKey: false, hint: 'department' },
          { name: 'enrollment_date', type: 'date', primaryKey: false, hint: 'date' },
        ],
      },
    ],
  },
  {
    name: 'employees',
    label: 'Employees',
    description: 'Employee directory with salary and department',
    tables: [
      {
        name: 'employees',
        rowCount: 20,
        columns: [
          { name: 'id', type: 'integer', primaryKey: true, hint: 'id' },
          { name: 'first_name', type: 'text', primaryKey: false, hint: 'first_name' },
          { name: 'last_name', type: 'text', primaryKey: false, hint: 'last_name' },
          { name: 'email', type: 'text', primaryKey: false, hint: 'email' },
          { name: 'department', type: 'text', primaryKey: false, hint: 'department' },
          { name: 'salary', type: 'real', primaryKey: false, hint: 'salary' },
          { name: 'hire_date', type: 'date', primaryKey: false, hint: 'date' },
        ],
      },
    ],
  },
  {
    name: 'ecommerce',
    label: 'E-Commerce',
    description: 'Products and orders with pricing',
    tables: [
      {
        name: 'products',
        rowCount: 12,
        columns: [
          { name: 'id', type: 'integer', primaryKey: true, hint: 'id' },
          { name: 'name', type: 'text', primaryKey: false, hint: 'title' },
          { name: 'price', type: 'real', primaryKey: false, hint: 'price' },
          { name: 'quantity', type: 'integer', primaryKey: false, hint: 'quantity' },
          { name: 'description', type: 'text', primaryKey: false, hint: 'description' },
        ],
      },
      {
        name: 'orders',
        rowCount: 20,
        columns: [
          { name: 'id', type: 'integer', primaryKey: true, hint: 'id' },
          { name: 'customer_name', type: 'text', primaryKey: false, hint: 'name' },
          { name: 'total_amount', type: 'real', primaryKey: false, hint: 'price' },
          { name: 'status', type: 'text', primaryKey: false, hint: 'status' },
          { name: 'order_date', type: 'date', primaryKey: false, hint: 'date' },
        ],
      },
    ],
  },
  {
    name: 'university',
    label: 'University',
    description: 'Students, courses, and departments with enrollment',
    tables: [
      {
        name: 'departments',
        rowCount: 5,
        columns: [
          { name: 'dept_id', type: 'integer', primaryKey: true, hint: 'id' },
          { name: 'dept_name', type: 'text', primaryKey: false, hint: 'department' },
          { name: 'building', type: 'text', primaryKey: false, hint: 'building' },
        ],
      },
      {
        name: 'students',
        rowCount: 15,
        columns: [
          { name: 'student_id', type: 'integer', primaryKey: true, hint: 'id' },
          { name: 'ra_no', type: 'text', primaryKey: false, hint: 'register_number' },
          { name: 'name', type: 'text', primaryKey: false, hint: 'name' },
          { name: 'gpa', type: 'real', primaryKey: false, hint: 'gpa' },
          {
            name: 'dept_id',
            type: 'integer',
            primaryKey: false,
            hint: 'auto',
            foreignKey: { table: 'departments', column: 'dept_id' },
          },
        ],
      },
      {
        name: 'courses',
        rowCount: 8,
        columns: [
          { name: 'course_id', type: 'integer', primaryKey: true, hint: 'id' },
          { name: 'title', type: 'text', primaryKey: false, hint: 'course_name' },
          { name: 'credits', type: 'integer', primaryKey: false, hint: 'credits' },
          {
            name: 'dept_id',
            type: 'integer',
            primaryKey: false,
            hint: 'auto',
            foreignKey: { table: 'departments', column: 'dept_id' },
          },
        ],
      },
    ],
  },
  {
    name: 'hospital',
    label: 'Hospital',
    description: 'Patients, doctors, and appointments',
    tables: [
      {
        name: 'doctors',
        rowCount: 8,
        columns: [
          { name: 'id', type: 'integer', primaryKey: true, hint: 'id' },
          { name: 'name', type: 'text', primaryKey: false, hint: 'name' },
          { name: 'department', type: 'text', primaryKey: false, hint: 'department' },
          { name: 'phone', type: 'text', primaryKey: false, hint: 'phone' },
        ],
      },
      {
        name: 'patients',
        rowCount: 20,
        columns: [
          { name: 'id', type: 'integer', primaryKey: true, hint: 'id' },
          { name: 'name', type: 'text', primaryKey: false, hint: 'name' },
          { name: 'age', type: 'integer', primaryKey: false, hint: 'age' },
          { name: 'gender', type: 'text', primaryKey: false, hint: 'gender' },
          { name: 'admission_date', type: 'date', primaryKey: false, hint: 'date' },
        ],
      },
    ],
  },
];

/* ── Backward compat (used by old dialog - can remove later) ─ */

export function generateSampleDataSQL(
  tableName: string,
  columns: { name: string; type: ColumnType; primaryKey?: boolean }[],
  rowCount: number,
): string {
  const table: GeneratorTableDef = {
    name: tableName,
    rowCount,
    columns: columns.map((c) => {
      const { hint } = detectHint(c.name);
      return { name: c.name, type: c.type, primaryKey: !!c.primaryKey, hint };
    }),
  };
  return generateTableSQL(table);
}
