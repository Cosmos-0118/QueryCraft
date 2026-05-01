import { describe, expect, it } from 'vitest';
import {
  detectHint,
  generateMultiTableDataRows,
  generateMultiTableSQL,
  generateTableDataRows,
  generateTableSQL,
  inferForeignKeys,
} from '@/lib/engine/data-generator';
import type { GeneratorTableDef } from '@/lib/engine/data-generator';

describe('data generator hint detection', () => {
  it('detects register number variants robustly', () => {
    const variants = [
      'register_no',
      'registerNo',
      'registration_number',
      'registrationNumber',
      'reg_no',
      'Reg Number',
      'RA No',
      'raNumber',
      'roll_no',
      'enrollment_no',
      'matric_no',
      'admission_no',
    ];

    for (const colName of variants) {
      const detected = detectHint(colName);
      expect(detected.hint).toBe('register_number');
      expect(detected.suggestedType).toBe('text');
    }
  });

  it('does not misclassify registration_date as register number', () => {
    const detected = detectHint('registration_date');
    expect(detected.hint).toBe('date');
    expect(detected.suggestedType).toBe('date');
  });
});

describe('data generator SQL output', () => {
  it('generates realistic RA-style register values', () => {
    const table: GeneratorTableDef = {
      name: 'students',
      rowCount: 3,
      columns: [
        { name: 'id', type: 'integer', primaryKey: true, hint: 'id' },
        { name: 'ra_no', type: 'text', primaryKey: false, hint: 'register_number' },
      ],
    };

    const sql = generateTableSQL(table);
    expect(sql).toContain('INSERT INTO "students" VALUES (1, ');
    expect(sql).toMatch(/'(RA|REG|ROLL|ENR)-?\d{4}-?\d{4}'/);
  });

  it('keeps non-integer primary keys unique', () => {
    const table: GeneratorTableDef = {
      name: 'inventory',
      rowCount: 18,
      columns: [
        { name: 'sku', type: 'text', primaryKey: true, hint: 'auto' },
        { name: 'name', type: 'text', primaryKey: false, hint: 'name' },
      ],
    };

    const rows = generateTableDataRows(table);
    const keys = rows.map((row) => row[0]);
    expect(new Set(keys).size).toBe(18);
  });

  it('infers foreign keys from naming and generates referentially aligned values', () => {
    const tables: GeneratorTableDef[] = [
      {
        name: 'departments',
        rowCount: 4,
        columns: [
          { name: 'dept_id', type: 'integer', primaryKey: true, hint: 'id' },
          { name: 'dept_name', type: 'text', primaryKey: false, hint: 'department' },
        ],
      },
      {
        name: 'students',
        rowCount: 12,
        columns: [
          { name: 'student_id', type: 'integer', primaryKey: true, hint: 'id' },
          { name: 'name', type: 'text', primaryKey: false, hint: 'name' },
          { name: 'dept_id', type: 'integer', primaryKey: false, hint: 'auto' },
        ],
      },
    ];

    const inferred = inferForeignKeys(tables);
    const studentsDeptId = inferred[1].columns.find((column) => column.name === 'dept_id');
    expect(studentsDeptId?.foreignKey).toEqual({ table: 'departments', column: 'dept_id' });

    const rowsByTable = generateMultiTableDataRows(tables);
    const departmentIds = new Set((rowsByTable.departments ?? []).map((row) => row[0]));
    const studentDeptIds = (rowsByTable.students ?? []).map((row) => row[2]);

    expect(studentDeptIds.length).toBe(12);
    expect(studentDeptIds.every((value) => departmentIds.has(value))).toBe(true);

    const sql = generateMultiTableSQL(tables);
    expect(sql).toContain('FOREIGN KEY ("dept_id") REFERENCES "departments"("dept_id")');
  });
});
