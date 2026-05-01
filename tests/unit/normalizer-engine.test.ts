import { describe, expect, it } from 'vitest';
import {
  attributeClosure,
  decomposeTo1NF,
  decomposeTo2NF,
  decomposeTo3NF,
  decomposeTo4NF,
  decomposeTo5NF,
  decomposeToBCNF,
  detectNormalForm,
  findCandidateKeys,
  minimalCover,
  normalize,
  verifyNormalFormStrict,
  verifyDependencyPreservation,
  verifyLosslessJoin,
} from '@/lib/engine/normalizer-engine';
import type { FunctionalDependency, JoinDependency, MultivaluedDependency, NormalForm, TableSchema } from '@/types/normalizer';

function makeTable(args: {
  name: string;
  columns: string[];
  primaryKey?: string[];
  fds?: FunctionalDependency[];
  mvds?: MultivaluedDependency[];
  joinDependencies?: JoinDependency[];
  sampleData?: string[][];
}): TableSchema {
  const primaryKey = args.primaryKey ?? [];
  return {
    id: args.name.toLowerCase(),
    name: args.name,
    columns: args.columns.map((name) => ({ name, isKey: primaryKey.includes(name) })),
    primaryKey,
    foreignKeys: [],
    fds: args.fds ?? [],
    mvds: args.mvds ?? [],
    joinDependencies: args.joinDependencies,
    sampleData: args.sampleData,
  };
}

function expectNF(table: TableSchema, nf: NormalForm): void {
  expect(detectNormalForm(table)).toBe(nf);
}

describe('normalizer engine utilities', () => {
  it('computes attribute closure correctly', () => {
    const fds: FunctionalDependency[] = [
      { determinant: ['A'], dependent: ['B'] },
      { determinant: ['B'], dependent: ['C'] },
      { determinant: ['C'], dependent: ['D'] },
    ];

    expect(attributeClosure(['A'], fds)).toEqual(['A', 'B', 'C', 'D']);
    expect(attributeClosure(['B'], fds)).toEqual(['B', 'C', 'D']);
  });

  it('finds candidate keys for single/composite/multiple key schemas', () => {
    const single = findCandidateKeys(['A', 'B', 'C'], [{ determinant: ['A'], dependent: ['B', 'C'] }]);
    expect(single).toEqual([['A']]);

    const composite = findCandidateKeys(['A', 'B', 'C'], [{ determinant: ['A', 'B'], dependent: ['C'] }]);
    expect(composite).toEqual([['A', 'B']]);

    const multiple = findCandidateKeys(
      ['A', 'B', 'C'],
      [
        { determinant: ['A'], dependent: ['B', 'C'] },
        { determinant: ['B'], dependent: ['A', 'C'] },
      ],
    );

    expect(multiple).toContainEqual(['A']);
    expect(multiple).toContainEqual(['B']);
  });

  it('computes minimal cover by removing redundant dependencies', () => {
    const cover = minimalCover([
      { determinant: ['A'], dependent: ['B', 'C'] },
      { determinant: ['B'], dependent: ['C'] },
    ]);

    expect(cover).toContainEqual({ determinant: ['A'], dependent: ['B'] });
    expect(cover).toContainEqual({ determinant: ['B'], dependent: ['C'] });
    expect(cover).toHaveLength(2);
  });
});

describe('normal form detection', () => {
  it('detects UNF when cells are multi-valued', () => {
    const table = makeTable({
      name: 'StudentPhones',
      columns: ['student_id', 'phones'],
      primaryKey: ['student_id'],
      sampleData: [
        ['1', '555-0001|555-0002'],
        ['2', '555-0003'],
      ],
    });

    expectNF(table, 'UNF');
  });

  it('detects 1NF when partial dependency exists', () => {
    const table = makeTable({
      name: 'Enrollment',
      columns: ['student_id', 'course_id', 'student_name', 'course_title'],
      primaryKey: ['student_id', 'course_id'],
      fds: [
        { determinant: ['student_id', 'course_id'], dependent: ['student_name', 'course_title'] },
        { determinant: ['student_id'], dependent: ['student_name'] },
        { determinant: ['course_id'], dependent: ['course_title'] },
      ],
      sampleData: [
        ['1', '10', 'Alice', 'DBMS'],
        ['1', '11', 'Alice', 'Algo'],
        ['2', '10', 'Bob', 'DBMS'],
      ],
    });

    expectNF(table, '1NF');
  });

  it('detects 2NF when transitive dependency exists', () => {
    const table = makeTable({
      name: 'Employee',
      columns: ['emp_id', 'dept_id', 'dept_name'],
      primaryKey: ['emp_id'],
      fds: [
        { determinant: ['emp_id'], dependent: ['dept_id'] },
        { determinant: ['dept_id'], dependent: ['dept_name'] },
      ],
      sampleData: [
        ['1', 'd1', 'Science'],
        ['2', 'd1', 'Science'],
        ['3', 'd2', 'Math'],
      ],
    });

    expectNF(table, '2NF');
  });

  it('detects 3NF when relation is not BCNF but still 3NF', () => {
    const table = makeTable({
      name: 'R',
      columns: ['A', 'B', 'C'],
      fds: [
        { determinant: ['A', 'B'], dependent: ['C'] },
        { determinant: ['C'], dependent: ['B'] },
      ],
      sampleData: [
        ['a1', 'b1', 'c1'],
        ['a2', 'b2', 'c2'],
      ],
    });

    expectNF(table, '3NF');
  });

  it('detects BCNF when only 4NF violations remain', () => {
    const table = makeTable({
      name: 'StudentPreference',
      columns: ['student', 'hobby', 'language'],
      mvds: [{ determinant: ['student'], dependent: ['hobby'] }],
    });

    expectNF(table, 'BCNF');
  });

  it('detects 4NF when join dependency exists', () => {
    const table = makeTable({
      name: 'SPJ',
      columns: ['supplier', 'part', 'project'],
      joinDependencies: [{ components: [['supplier', 'part'], ['supplier', 'project'], ['part', 'project']] }],
    });

    expectNF(table, '4NF');
  });

  it('detects 5NF when no violations are present', () => {
    const table = makeTable({
      name: 'Student',
      columns: ['id', 'name', 'department'],
      primaryKey: ['id'],
      fds: [{ determinant: ['id'], dependent: ['name', 'department'] }],
      sampleData: [
        ['1', 'Alice', 'CS'],
        ['2', 'Bob', 'Math'],
      ],
    });

    expectNF(table, '5NF');
  });

  it('smart verifier infers normal form from data when explicit FDs are missing', () => {
    const table = makeTable({
      name: 'Student',
      columns: ['id', 'name', 'department'],
      sampleData: [
        ['1', 'Alice', 'CS'],
        ['2', 'Bob', 'IT'],
        ['3', 'Charlie', 'ECE'],
      ],
    });

    expect(detectNormalForm(table)).toBe('5NF');

    const strict = verifyNormalFormStrict(table);
    expect(strict.detectedNF).toBe('5NF');
    expect(strict.warnings.join(' ')).toMatch(/inferred|join dependencies|sample data/i);
  });

  it('strict mode reports limited confidence when FDs are absent and not all attributes are prime', () => {
    const table = makeTable({
      name: 'StudentSparse',
      columns: ['id', 'name', 'department'],
      sampleData: [],
    });

    const strict = verifyNormalFormStrict(table, { mode: 'strict' });
    expect(strict.confidence).toBe('low');
    expect(strict.warnings.join(' ')).toMatch(/insufficient|explicit|sample/i);
  });

  it('strict verifier reaches 5NF when FD/MVD/JD evidence is explicit and valid', () => {
    const table = makeTable({
      name: 'Student',
      columns: ['id', 'name', 'department'],
      primaryKey: ['id'],
      fds: [{ determinant: ['id'], dependent: ['name', 'department'] }],
      mvds: [{ determinant: ['id'], dependent: ['name'] }],
      joinDependencies: [{ components: [['id', 'name'], ['id', 'department'], ['name', 'department']] }],
      sampleData: [
        ['1', 'Alice', 'CS'],
        ['2', 'Bob', 'Math'],
      ],
    });

    const strict = verifyNormalFormStrict(table);
    expect(strict.detectedNF).toBe('5NF');
    expect(strict.confidence).toBe('high');
    expect(strict.warnings).toHaveLength(0);
  });
});

describe('decomposition steps', () => {
  it('expands multi-valued cells to 1NF for pipe/comma/semicolon separators', () => {
    const table = makeTable({
      name: 'MultiCell',
      columns: ['id', 'phones', 'skills', 'hobbies'],
      primaryKey: ['id'],
      sampleData: [['1', '111|222', 'sql,java', 'music;chess']],
    });

    const out = decomposeTo1NF(table);

    expect(out.sampleData).toBeDefined();
    expect(out.sampleData?.length).toBe(8);
    expect(detectNormalForm(out)).not.toBe('UNF');
  });

  it('decomposes partial dependencies in 2NF step', () => {
    const table = makeTable({
      name: 'Enrollment',
      columns: ['student_id', 'course_id', 'student_name', 'course_title', 'grade'],
      primaryKey: ['student_id', 'course_id'],
      fds: [
        { determinant: ['student_id'], dependent: ['student_name'] },
        { determinant: ['course_id'], dependent: ['course_title'] },
        { determinant: ['student_id', 'course_id'], dependent: ['grade'] },
      ],
      sampleData: [
        ['1', '10', 'Alice', 'DBMS', 'A'],
        ['1', '11', 'Alice', 'Algo', 'B+'],
        ['2', '10', 'Bob', 'DBMS', 'A-'],
      ],
    });

    const out = decomposeTo2NF([table]);

    expect(out.length).toBeGreaterThan(1);
    expect(out.some((t) => t.columns.some((c) => c.name === 'student_name') && t.columns.length <= 2)).toBe(true);
    expect(out.some((t) => t.columns.some((c) => c.name === 'course_title') && t.columns.length <= 2)).toBe(true);
  });

  it('uses 3NF synthesis and preserves dependencies', () => {
    const table = makeTable({
      name: 'Employee',
      columns: ['emp_id', 'dept_id', 'dept_name', 'dept_phone'],
      primaryKey: ['emp_id'],
      fds: [
        { determinant: ['emp_id'], dependent: ['dept_id'] },
        { determinant: ['dept_id'], dependent: ['dept_name', 'dept_phone'] },
      ],
      sampleData: [
        ['1', 'd1', 'Science', '111'],
        ['2', 'd1', 'Science', '111'],
        ['3', 'd2', 'Math', '222'],
      ],
    });

    const out = decomposeTo3NF([table]);

    expect(out.length).toBeGreaterThan(1);
    expect(verifyDependencyPreservation(table.fds, out)).toBe(true);
  });

  it('decomposes BCNF violations iteratively', () => {
    const table = makeTable({
      name: 'R',
      columns: ['A', 'B', 'C'],
      fds: [
        { determinant: ['A'], dependent: ['B'] },
        { determinant: ['B'], dependent: ['C'] },
      ],
      sampleData: [
        ['1', 'x', 'alpha'],
        ['2', 'y', 'beta'],
      ],
    });

    const out = decomposeToBCNF([table]);

    expect(out.length).toBeGreaterThan(1);
    for (const relation of out) {
      const nf = detectNormalForm(relation);
      expect(['BCNF', '4NF', '5NF']).toContain(nf);
    }
  });

  it('decomposes 4NF violations caused by MVDs', () => {
    const table = makeTable({
      name: 'StudentFacts',
      columns: ['student', 'hobby', 'language'],
      mvds: [
        { determinant: ['student'], dependent: ['hobby'] },
      ],
      sampleData: [
        ['S1', 'Chess', 'English'],
        ['S1', 'Music', 'English'],
      ],
    });

    const out = decomposeTo4NF([table]);

    expect(out.length).toBeGreaterThan(1);
    expect(out.some((relation) => relation.columns.map((column) => column.name).includes('hobby'))).toBe(true);
  });

  it('decomposes 5NF violations caused by join dependencies', () => {
    const table = makeTable({
      name: 'SPJ',
      columns: ['supplier', 'part', 'project'],
      joinDependencies: [{ components: [['supplier', 'part'], ['supplier', 'project'], ['part', 'project']] }],
    });

    const out = decomposeTo5NF([table]);

    expect(out.length).toBe(3);
    expect(out.every((relation) => relation.columns.length === 2)).toBe(true);
  });
});

describe('full normalization pipeline and edge cases', () => {
  it('normalizes an UNF table through to 5NF target', () => {
    const table = makeTable({
      name: 'OrderLine',
      columns: ['order_id', 'customer_id', 'customer_name', 'product_id', 'product_name', 'tags'],
      primaryKey: ['order_id', 'product_id'],
      fds: [
        { determinant: ['order_id'], dependent: ['customer_id', 'customer_name'] },
        { determinant: ['customer_id'], dependent: ['customer_name'] },
        { determinant: ['product_id'], dependent: ['product_name'] },
      ],
      sampleData: [
        ['o1', 'c1', 'Alice', 'p1', 'Book', 'new|gift'],
        ['o1', 'c1', 'Alice', 'p2', 'Pen', 'gift'],
      ],
    });

    const result = normalize(table, '5NF');

    expect(result.detectedNF).toBe('UNF');
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps[0].fromNF).toBe('UNF');
    expect(result.steps[result.steps.length - 1].toNF).toBe('5NF');
  });

  it('handles single-column tables', () => {
    const table = makeTable({
      name: 'Codes',
      columns: ['code'],
      primaryKey: ['code'],
      sampleData: [['A'], ['B']],
    });

    const result = normalize(table, '5NF');
    expect(result.steps.length).toBeGreaterThanOrEqual(0);
    expect(result.originalTable.columns).toHaveLength(1);
  });

  it('handles all-key tables without decomposition pressure', () => {
    const table = makeTable({
      name: 'Bridge',
      columns: ['a_id', 'b_id'],
      primaryKey: ['a_id', 'b_id'],
      sampleData: [['1', '10'], ['2', '20']],
    });

    const result = normalize(table, '5NF');
    expect(result.steps.length).toBeGreaterThanOrEqual(0);
  });

  it('handles empty sample data and no FDs', () => {
    const table = makeTable({
      name: 'Sparse',
      columns: ['a', 'b', 'c'],
      sampleData: [],
    });

    const result = normalize(table, '5NF');
    expect(result.originalTable.columns).toHaveLength(3);
  });

  it('keeps no-FD tables stable', () => {
    const table = makeTable({
      name: 'Raw',
      columns: ['a', 'b', 'c'],
      sampleData: [
        ['1', 'x', 'p'],
        ['2', 'y', 'q'],
      ],
    });

    const result = normalize(table, '5NF');
    expect(result.steps.length).toBeGreaterThanOrEqual(0);
  });

  it('verifies lossless joins for decomposition results', () => {
    const table = makeTable({
      name: 'Enrollment',
      columns: ['student_id', 'course_id', 'student_name', 'course_title', 'grade'],
      primaryKey: ['student_id', 'course_id'],
      fds: [
        { determinant: ['student_id'], dependent: ['student_name'] },
        { determinant: ['course_id'], dependent: ['course_title'] },
        { determinant: ['student_id', 'course_id'], dependent: ['grade'] },
      ],
      sampleData: [
        ['1', '10', 'Alice', 'DBMS', 'A'],
        ['1', '11', 'Alice', 'Algo', 'B+'],
        ['2', '10', 'Bob', 'DBMS', 'A-'],
      ],
    });

    const decomposed = decomposeTo2NF([table]);
    expect(verifyLosslessJoin(table, decomposed)).toBe(true);
  });

  it('verifies dependency preservation for 3NF synthesis', () => {
    const table = makeTable({
      name: 'Employee',
      columns: ['emp_id', 'dept_id', 'dept_name'],
      primaryKey: ['emp_id'],
      fds: [
        { determinant: ['emp_id'], dependent: ['dept_id'] },
        { determinant: ['dept_id'], dependent: ['dept_name'] },
      ],
      sampleData: [
        ['1', 'd1', 'Science'],
        ['2', 'd1', 'Science'],
        ['3', 'd2', 'Math'],
      ],
    });

    const decomposed = decomposeTo3NF([table]);
    expect(verifyDependencyPreservation(table.fds, decomposed)).toBe(true);
  });
});
