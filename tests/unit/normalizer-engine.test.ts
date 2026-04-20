import { describe, expect, it } from 'vitest';
import {
  decompose,
  detectNormalForm,
  inferPrimaryKey,
  inferFunctionalDependencies,
} from '@/lib/engine/normalizer-engine';
import type { NormalForm, NormalizerTable } from '@/types/normalizer';

const NORMAL_FORM_RANK: Record<NormalForm, number> = {
  UNF: 0,
  '1NF': 1,
  '2NF': 2,
  '3NF': 3,
  BCNF: 4,
  '4NF': 5,
  '5NF': 6,
};

function isAtLeast(actual: NormalForm, expected: NormalForm): boolean {
  return NORMAL_FORM_RANK[actual] >= NORMAL_FORM_RANK[expected];
}

describe('normalizer-engine decomposition correctness', () => {
  it('enforces 1NF atomic values when UNF rows contain repeating groups', () => {
    const table: NormalizerTable = {
      name: 'Contacts',
      columns: ['id', 'name', 'phone'],
      primaryKey: ['id'],
      functionalDependencies: [{ determinant: ['id'], dependent: ['name', 'phone'] }],
      sampleData: [
        ['1', 'Alice', '111,222'],
        ['2', 'Bob', '333'],
      ],
    };

    const result = decompose(table, '1NF');
    const oneNFStep = result.steps.find((step) => step.normalForm === '1NF');

    expect(oneNFStep).toBeDefined();
    expect(oneNFStep?.tables).toHaveLength(1);

    const flattenedRows = oneNFStep?.tables[0].sampleData ?? [];
    expect(flattenedRows.length).toBeGreaterThanOrEqual(3);
    expect(
      flattenedRows.every((row) => row.every((cell) => !cell.includes('|') && !cell.includes(','))),
    ).toBe(true);
  });

  it('infers functional dependencies automatically from entered table values', () => {
    const columns = ['student_id', 'student_name', 'dept', 'course_id', 'grade'];
    const rows = [
      ['1', 'Alice', 'CS', 'DB101', 'A'],
      ['1', 'Alice', 'CS', 'OS201', 'B+'],
      ['2', 'Bob', 'Math', 'DB101', 'A-'],
      ['2', 'Bob', 'Math', 'AL301', 'A'],
    ];

    const inferred = inferFunctionalDependencies(columns, rows);
    const studentFD = inferred.find(
      (fd) => fd.determinant.length === 1 && fd.determinant[0] === 'student_id',
    );

    expect(studentFD).toBeDefined();
    expect(studentFD?.dependent).toContain('student_name');
    expect(studentFD?.dependent).toContain('dept');
  });

  it('infers id -> non-key attributes for surrogate-id tables even without repeats', () => {
    const columns = ['id', 'name', 'department', 'email'];
    const rows = [
      ['1', 'Alice', 'CS', 'alice@x.com'],
      ['2', 'Bob', 'Math', 'bob@x.com'],
      ['3', 'Carol', 'Physics', 'carol@x.com'],
    ];

    const inferred = inferFunctionalDependencies(columns, rows);
    const idFD = inferred.find((fd) => fd.determinant.length === 1 && fd.determinant[0] === 'id');

    expect(idFD).toBeDefined();
    expect(idFD?.dependent).toContain('name');
    expect(idFD?.dependent).toContain('department');
    expect(idFD?.dependent).toContain('email');
  });

  it('infers registration-style key dependencies for unrepeated identifier-like columns', () => {
    const columns = ['registration_number', 'student_name', 'department'];
    const rows = [
      ['CRD001', 'Alice', 'CS'],
      ['CRD002', 'Bob', 'Math'],
      ['CRD003', 'Carol', 'Physics'],
    ];

    const inferred = inferFunctionalDependencies(columns, rows);
    const registrationFD = inferred.find(
      (fd) => fd.determinant.length === 1 && fd.determinant[0] === 'registration_number',
    );

    expect(registrationFD).toBeDefined();
    expect(registrationFD?.dependent).toContain('student_name');
    expect(registrationFD?.dependent).toContain('department');
  });

  it('converts parallel comma-separated repeating groups using aligned rows in 1NF', () => {
    const table: NormalizerTable = {
      name: 'R',
      columns: ['customer', 'hobbies', 'orderid', 'products', 'supplier'],
      primaryKey: ['customer'],
      functionalDependencies: [],
      sampleData: [
        ['1', 'ravi', 'pen,book', 's1,s2', 'cricket,music'],
        ['2', 'priya', 'pencil,eraser', 's1,s3', 'dance,reading'],
      ],
    };

    const result = decompose(table, '1NF');
    const oneNFStep = result.steps.find((step) => step.normalForm === '1NF');
    const rows = oneNFStep?.tables[0]?.sampleData ?? [];

    expect(oneNFStep).toBeDefined();
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual(['1', 'ravi', 'pen', 's1', 'cricket']);
    expect(rows[1]).toEqual(['1', 'ravi', 'book', 's2', 'music']);
    expect(rows[2]).toEqual(['2', 'priya', 'pencil', 's1', 'dance']);
    expect(rows[3]).toEqual(['2', 'priya', 'eraser', 's3', 'reading']);
  });

  it('does not split natural text values that contain commas with spaces', () => {
    const table: NormalizerTable = {
      name: 'Addresses',
      columns: ['id', 'name', 'address'],
      primaryKey: ['id'],
      functionalDependencies: [],
      sampleData: [
        ['1', 'Alice', 'New York, NY'],
        ['2', 'Bob', 'Los Angeles, CA'],
      ],
    };

    const result = decompose(table, '1NF');
    const oneNFStep = result.steps.find((step) => step.normalForm === '1NF');
    const rows = oneNFStep?.tables[0]?.sampleData ?? [];

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['1', 'Alice', 'New York, NY']);
    expect(rows[1]).toEqual(['2', 'Bob', 'Los Angeles, CA']);
  });

  it('does not infer false customer -> orderid dependency after atomic expansion', () => {
    const columns = ['customer', 'hobbies', 'orderid', 'products', 'supplier'];
    const rows = [
      ['1', 'ravi', 'pen', 's1', 'cricket'],
      ['1', 'ravi', 'book', 's2', 'music'],
      ['2', 'priya', 'pencil', 's1', 'dance'],
      ['2', 'priya', 'eraser', 's3', 'reading'],
    ];

    const inferred = inferFunctionalDependencies(columns, rows);
    const customerFD = inferred.find(
      (fd) => fd.determinant.length === 1 && fd.determinant[0] === 'customer',
    );

    expect(customerFD).toBeDefined();
    expect(customerFD?.dependent).toContain('hobbies');
    expect(customerFD?.dependent).not.toContain('orderid');
  });

  it('does not treat unique-but-unrepeated columns as trusted key determinants', () => {
    const columns = ['course_id', 'student_id', 'student_name'];
    const rows = [
      ['DB101', '1', 'Alice'],
      ['OS201', '1', 'Alice'],
      ['AL301', '2', 'Bob'],
    ];

    const inferred = inferFunctionalDependencies(columns, rows);

    const courseFD = inferred.find(
      (fd) => fd.determinant.length === 1 && fd.determinant[0] === 'course_id',
    );
    expect(courseFD).toBeUndefined();

    const studentFD = inferred.find(
      (fd) => fd.determinant.length === 1 && fd.determinant[0] === 'student_id',
    );
    expect(studentFD).toBeDefined();
    expect(studentFD?.dependent).toContain('student_name');
  });

  it('still produces 2NF decomposition for small samples with only one repeated determinant group', () => {
    const columns = ['student_id', 'course_id', 'student_name', 'dept', 'grade'];
    const rows = [
      ['1', 'DB101', 'Alice', 'CS', 'A'],
      ['1', 'OS201', 'Alice', 'CS', 'B+'],
      ['2', 'AL301', 'Bob', 'Math', 'A'],
    ];

    const inferred = inferFunctionalDependencies(columns, rows);
    const studentFD = inferred.find(
      (fd) => fd.determinant.length === 1 && fd.determinant[0] === 'student_id',
    );

    expect(studentFD).toBeDefined();
    expect(studentFD?.dependent).toContain('student_name');
    expect(studentFD?.dependent).toContain('dept');

    const result = decompose(
      {
        name: 'SmallEnrollment',
        columns,
        primaryKey: ['student_id', 'course_id'],
        functionalDependencies: inferred,
        sampleData: rows,
      },
      '2NF',
    );

    const twoNFStep = result.steps.find((step) => step.normalForm === '2NF');
    expect(twoNFStep).toBeDefined();
    expect((twoNFStep?.tables ?? []).length).toBeGreaterThan(1);
  });

  it('keeps 3NF decomposition stable for repeating-group sample without spurious single-attribute FDs', () => {
    const table: NormalizerTable = {
      name: 'R',
      columns: ['customer', 'hobbies', 'order', 'product', 'supplier'],
      primaryKey: ['customer'],
      functionalDependencies: [],
      sampleData: [
        ['1', 'ravi', 'pen,book', 's1,s2', 'cricket,music'],
        ['2', 'priya', 'pencil,eraser', 's1,s3', 'dance,reading'],
        ['3', 'arun', 'pen', 's2', 'music'],
      ],
    };

    const result = decompose(table, '3NF');
    const threeNFStep = result.steps.find((step) => step.normalForm === '3NF');

    expect(threeNFStep).toBeDefined();
    const tables = threeNFStep?.tables ?? [];
    expect(tables.length).toBeGreaterThanOrEqual(2);

    const wideRelation = tables.find((relation) => relation.columns.length >= 4);
    expect(wideRelation).toBeDefined();

    const wideFDs = wideRelation?.functionalDependencies ?? [];
    const badFD = wideFDs.find(
      (fd) => fd.determinant.length === 1 && fd.determinant[0] === 'customer' && fd.dependent.includes('order'),
    );
    expect(badFD).toBeUndefined();

    for (const relation of tables) {
      const relationNF = detectNormalForm(relation.columns, relation.functionalDependencies);
      expect(isAtLeast(relationNF, '3NF')).toBe(true);
    }
  });

  it('produces 2NF tables for partial dependency scenarios', () => {
    const table: NormalizerTable = {
      name: 'StudentDept',
      columns: ['student_id', 'course_id', 'student_name', 'dept', 'grade'],
      primaryKey: ['student_id', 'course_id'],
      functionalDependencies: [
        { determinant: ['student_id', 'course_id'], dependent: ['grade'] },
        { determinant: ['student_id'], dependent: ['student_name', 'dept'] },
      ],
    };

    const result = decompose(table, '2NF');
    const twoNFStep = result.steps.find((step) => step.normalForm === '2NF');

    expect(twoNFStep).toBeDefined();
    expect(twoNFStep?.tables.length).toBeGreaterThan(1);

    for (const relation of twoNFStep?.tables ?? []) {
      const relationNF = detectNormalForm(relation.columns, relation.functionalDependencies);
      expect(isAtLeast(relationNF, '2NF')).toBe(true);
    }
  });

  it('synthesizes 3NF tables for transitive dependency scenarios', () => {
    const table: NormalizerTable = {
      name: 'Employee',
      columns: ['emp_id', 'emp_name', 'dept_id', 'dept_name', 'manager'],
      primaryKey: ['emp_id'],
      functionalDependencies: [
        { determinant: ['emp_id'], dependent: ['emp_name', 'dept_id'] },
        { determinant: ['dept_id'], dependent: ['dept_name', 'manager'] },
      ],
    };

    const result = decompose(table, '3NF');
    const threeNFStep = result.steps.find((step) => step.normalForm === '3NF');

    expect(threeNFStep).toBeDefined();
    expect(threeNFStep?.tables.length).toBeGreaterThan(1);

    for (const relation of threeNFStep?.tables ?? []) {
      const relationNF = detectNormalForm(relation.columns, relation.functionalDependencies);
      expect(isAtLeast(relationNF, '3NF')).toBe(true);
    }
  });

  it('decomposes BCNF violations until every relation satisfies BCNF', () => {
    const table: NormalizerTable = {
      name: 'CourseInstructor',
      columns: ['student', 'course', 'instructor'],
      primaryKey: ['student', 'course'],
      functionalDependencies: [
        { determinant: ['student', 'course'], dependent: ['instructor'] },
        { determinant: ['instructor'], dependent: ['course'] },
      ],
    };

    const result = decompose(table, 'BCNF');
    const bcnfStep = result.steps.find((step) => step.normalForm === 'BCNF');

    expect(bcnfStep).toBeDefined();
    expect(bcnfStep?.tables.length).toBeGreaterThan(1);

    for (const relation of bcnfStep?.tables ?? []) {
      const relationNF = detectNormalForm(relation.columns, relation.functionalDependencies);
      expect(relationNF).toBe('BCNF');
    }
  });

  it('infers primary key from row uniqueness when FDs are empty', () => {
    const columns = ['id', 'name', 'address'];
    const rows = [
      ['1', 'Alice', 'New York, NY'],
      ['2', 'Bob', 'Los Angeles, CA'],
      ['3', 'Carol', 'Chicago, IL'],
    ];

    const inferredKey = inferPrimaryKey(columns, rows, []);
    expect(inferredKey).toEqual(['id']);

    const result = decompose(
      {
        name: 'Contacts',
        columns,
        primaryKey: [],
        functionalDependencies: [],
        sampleData: rows,
      },
      '2NF',
    );

    expect(result.originalTable.primaryKey).toEqual(['id']);
  });

  it('decomposes to 4NF when non-trivial multivalued dependencies appear in rows', () => {
    const table: NormalizerTable = {
      name: 'StudentChoices',
      columns: ['student', 'course', 'hobby'],
      primaryKey: ['student', 'course', 'hobby'],
      functionalDependencies: [],
      sampleData: [
        ['S1', 'DB', 'Music'],
        ['S1', 'DB', 'Chess'],
        ['S1', 'OS', 'Music'],
        ['S1', 'OS', 'Chess'],
        ['S2', 'AI', 'Art'],
        ['S2', 'AI', 'Travel'],
      ],
    };

    const result = decompose(table, '4NF');
    const fourNFStep = result.steps.find((step) => step.normalForm === '4NF');

    expect(fourNFStep).toBeDefined();
    expect((fourNFStep?.tables ?? []).length).toBeGreaterThan(1);

    const tableShapes = (fourNFStep?.tables ?? [])
      .map((relation) => relation.columns.join(','))
      .sort((a, b) => a.localeCompare(b));

    expect(tableShapes).toContain('course,student');
    expect(tableShapes).toContain('hobby,student');

    for (const relation of fourNFStep?.tables ?? []) {
      const relationNF = detectNormalForm(
        relation.columns,
        relation.functionalDependencies,
        undefined,
        relation.sampleData,
      );
      expect(isAtLeast(relationNF, '4NF')).toBe(true);
    }
  });

  it('decomposes to 5NF when ternary join dependency is detected', () => {
    const table: NormalizerTable = {
      name: 'SupplierPartProject',
      columns: ['supplier', 'part', 'project'],
      primaryKey: ['supplier', 'part', 'project'],
      functionalDependencies: [],
      sampleData: [
        ['S1', 'P1', 'J1'],
        ['S1', 'P1', 'J2'],
        ['S1', 'P2', 'J1'],
        ['S2', 'P1', 'J1'],
      ],
    };

    const detectedBefore = detectNormalForm(
      table.columns,
      table.functionalDependencies,
      undefined,
      table.sampleData,
    );
    expect(detectedBefore).toBe('4NF');

    const result = decompose(table, '5NF');
    const fiveNFStep = result.steps.find((step) => step.normalForm === '5NF');

    expect(fiveNFStep).toBeDefined();
    expect((fiveNFStep?.tables ?? []).length).toBeGreaterThanOrEqual(3);

    const allBinary = (fiveNFStep?.tables ?? []).every((relation) => relation.columns.length === 2);
    expect(allBinary).toBe(true);

    for (const relation of fiveNFStep?.tables ?? []) {
      const relationNF = detectNormalForm(
        relation.columns,
        relation.functionalDependencies,
        undefined,
        relation.sampleData,
      );
      expect(isAtLeast(relationNF, '5NF')).toBe(true);
    }
  });
});
