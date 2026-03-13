import { describe, expect, it } from 'vitest';
import { detectHint, generateTableSQL } from '@/lib/engine/data-generator';
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
});
