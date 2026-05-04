import { describe, expect, it } from 'vitest';
import {
  detectMultivaluedDependenciesFromData,
  inferCandidateKeysFromData,
  verifyNormalForm,
  verifyNormalFormStrict,
} from '@/lib/engine/normalizer-engine';
import type {
  FunctionalDependency,
  JoinDependency,
  MultivaluedDependency,
  TableSchema,
} from '@/types/normalizer';

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

describe('verifyNormalForm — UNF and 1NF detection', () => {
  it('reports UNF with high confidence when sample cells contain delimiters', () => {
    const table = makeTable({
      name: 'StudentPhones',
      columns: ['student_id', 'phones'],
      primaryKey: ['student_id'],
      sampleData: [
        ['1', '555-0001|555-0002'],
        ['2', '555-0003;555-0004'],
        ['3', '555-0005,555-0006'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('UNF');
    expect(report.confidence).toBe('high');
    expect(report.reasons.join(' ')).toMatch(/multi-valued|repeating/i);
  });

  it('separates explicitly-multi-valued columns from atomic ones', () => {
    const table = makeTable({
      name: 'Mix',
      columns: ['id', 'tags'],
      primaryKey: ['id'],
      sampleData: [
        ['1', 'one'],
        ['2', 'two|three'],
        ['3', 'four'],
      ],
    });

    expect(verifyNormalForm(table).detectedNF).toBe('UNF');
  });

  it('returns 1NF (low confidence) for an empty schema', () => {
    const table = makeTable({ name: 'Empty', columns: [] });
    const report = verifyNormalForm(table);

    expect(report.detectedNF).toBe('1NF');
    expect(report.confidence).toBe('low');
    expect(report.warnings.join(' ')).toMatch(/no columns/i);
  });

  it('returns 1NF when partial dependencies are explicitly violated', () => {
    const table = makeTable({
      name: 'Enrollment',
      columns: ['student_id', 'course_id', 'student_name', 'course_title', 'grade'],
      primaryKey: ['student_id', 'course_id'],
      fds: [
        { determinant: ['student_id', 'course_id'], dependent: ['grade'] },
        { determinant: ['student_id'], dependent: ['student_name'] },
        { determinant: ['course_id'], dependent: ['course_title'] },
      ],
      sampleData: [
        ['1', '10', 'Alice', 'DBMS', 'A'],
        ['1', '11', 'Alice', 'Algo', 'B+'],
        ['2', '10', 'Bob', 'DBMS', 'A-'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('1NF');
    expect(report.violations.partial.length).toBeGreaterThan(0);
    expect(report.confidence).toBe('high');
  });
});

describe('verifyNormalForm — structural reasoning', () => {
  it('treats two-column bridge tables as 5NF (production case from issue)', () => {
    const table = makeTable({
      name: 'StudentCourse',
      columns: ['student_id', 'course'],
      primaryKey: ['student_id', 'course'],
      sampleData: [
        ['1', 'DBMS'],
        ['1', 'OS'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('5NF');
    expect(report.evidence.allAttributesPrime).toBe(true);
    expect(report.reasons.join(' ')).toMatch(/two-attribute/i);
  });

  it('treats two-column tables as 5NF even without an explicit primary key', () => {
    const table = makeTable({
      name: 'StudentCourseRaw',
      columns: ['student_id', 'course'],
      sampleData: [
        ['1', 'DBMS'],
        ['1', 'OS'],
        ['2', 'DBMS'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('5NF');
  });

  it('treats single-column relations as 5NF', () => {
    const table = makeTable({
      name: 'Codes',
      columns: ['code'],
      primaryKey: ['code'],
      sampleData: [['A'], ['B'], ['C']],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('5NF');
  });

  it('recognises all-prime three-column relations as at least BCNF', () => {
    const table = makeTable({
      name: 'AllKey',
      columns: ['a', 'b', 'c'],
      primaryKey: ['a', 'b', 'c'],
      sampleData: [
        ['1', 'x', 'p'],
        ['2', 'y', 'q'],
        ['3', 'z', 'r'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(['BCNF', '4NF', '5NF']).toContain(report.detectedNF);
    expect(report.evidence.allAttributesPrime).toBe(true);
  });

  it('does not over-claim 4NF when MVDs are present in all-prime relations', () => {
    const table = makeTable({
      name: 'SPJ',
      columns: ['supplier', 'part', 'project'],
      primaryKey: ['supplier', 'part', 'project'],
      mvds: [{ determinant: ['supplier'], dependent: ['part'] }],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('BCNF');
    expect(report.violations.mvd.length).toBeGreaterThan(0);
  });

  it('detects 4NF when join dependency exists in all-prime relation', () => {
    const table = makeTable({
      name: 'SPJ',
      columns: ['supplier', 'part', 'project'],
      primaryKey: ['supplier', 'part', 'project'],
      joinDependencies: [{ components: [['supplier', 'part'], ['supplier', 'project'], ['part', 'project']] }],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('4NF');
    expect(report.violations.jd.length).toBeGreaterThan(0);
  });
});

describe('verifyNormalForm — explicit FD pipeline', () => {
  it('detects 2NF when only transitive dependencies remain', () => {
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

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('2NF');
    expect(report.violations.transitive.length).toBeGreaterThan(0);
    expect(report.confidence).toBe('high');
  });

  it('detects 3NF when there is a non-prime overlap (textbook 3NF-but-not-BCNF)', () => {
    const table = makeTable({
      name: 'R',
      columns: ['A', 'B', 'C'],
      fds: [
        { determinant: ['A', 'B'], dependent: ['C'] },
        { determinant: ['C'], dependent: ['B'] },
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('3NF');
    expect(report.violations.bcnf.length).toBeGreaterThan(0);
  });

  it('reaches BCNF for canonical id->* relations', () => {
    const table = makeTable({
      name: 'Student',
      columns: ['id', 'name', 'department'],
      primaryKey: ['id'],
      fds: [{ determinant: ['id'], dependent: ['name', 'department'] }],
      sampleData: [
        ['1', 'Alice', 'CS'],
        ['2', 'Bob', 'IT'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(['BCNF', '4NF', '5NF']).toContain(report.detectedNF);
    expect(report.violations.partial).toHaveLength(0);
    expect(report.violations.transitive).toHaveLength(0);
    expect(report.violations.bcnf).toHaveLength(0);
  });

  it('detects MVD violation as 4NF cap', () => {
    const table = makeTable({
      name: 'EmployeeProjects',
      columns: ['emp_id', 'project', 'skill'],
      primaryKey: ['emp_id', 'project', 'skill'],
      fds: [],
      mvds: [{ determinant: ['emp_id'], dependent: ['project'] }],
      sampleData: [
        ['e1', 'p1', 'sql'],
        ['e1', 'p2', 'sql'],
        ['e1', 'p1', 'java'],
        ['e1', 'p2', 'java'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('BCNF');
    expect(report.violations.mvd.length).toBeGreaterThan(0);
  });
});

describe('verifyNormalForm — confidence tiers', () => {
  it('reports high confidence with explicit FDs and PK', () => {
    const table = makeTable({
      name: 'Student',
      columns: ['id', 'name'],
      primaryKey: ['id'],
      fds: [{ determinant: ['id'], dependent: ['name'] }],
      sampleData: [
        ['1', 'Alice'],
        ['2', 'Bob'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.confidence).toBe('high');
  });

  it('reports medium confidence when FDs are inferred from a healthy sample', () => {
    const rows = Array.from({ length: 12 }, (_, index) => [
      `S${index + 1}`,
      `Student ${index + 1}`,
      index < 6 ? 'CS' : 'IT',
    ]);

    const table = makeTable({
      name: 'StudentInferred',
      columns: ['id', 'name', 'department'],
      sampleData: rows,
    });

    const report = verifyNormalForm(table);
    expect(report.evidence.hasInferredFDs).toBe(true);
    expect(report.evidence.fdEvidence).toBe('inferred');
    expect(report.confidence === 'medium' || report.confidence === 'low').toBe(true);
  });

  it('reports low confidence when no FDs are inferable and table has non-prime attributes', () => {
    const table = makeTable({
      name: 'Sparse',
      columns: ['a', 'b', 'c', 'd'],
      sampleData: [],
    });

    const report = verifyNormalForm(table);
    expect(report.confidence).toBe('low');
    expect(report.warnings.join(' ').length).toBeGreaterThan(0);
  });

  it('strict mode never auto-claims beyond structurally provable forms', () => {
    const table = makeTable({
      name: 'Sparse',
      columns: ['id', 'name', 'department'],
      sampleData: [
        ['1', 'Alice', 'CS'],
        ['2', 'Bob', 'IT'],
        ['3', 'Charlie', 'ECE'],
      ],
    });

    const smart = verifyNormalForm(table, { mode: 'smart' });
    expect(smart.evidence.hasInferredFDs).toBe(true);

    const strict = verifyNormalForm(table, { mode: 'strict' });
    expect(strict.evidence.hasInferredFDs).toBe(false);
    expect(strict.confidence === 'low' || strict.confidence === 'medium').toBe(true);
  });

  it('caps strict-mode confidence when no explicit FDs are provided and attributes are not all prime', () => {
    const table = makeTable({
      name: 'StrictNoFD',
      columns: ['a', 'b', 'c', 'd'],
      sampleData: [
        ['1', 'x', 'alpha', 'red'],
        ['2', 'y', 'beta', 'blue'],
      ],
    });

    const strict = verifyNormalForm(table, { mode: 'strict' });
    expect(strict.confidence).toBe('low');
  });
});

describe('verifyNormalForm — MVD inference from sample data', () => {
  it('detects MVDs when data forms a clear cross-product structure', () => {
    const rows: string[][] = [];
    for (const project of ['p1', 'p2', 'p3']) {
      for (const skill of ['sql', 'java', 'python']) {
        rows.push(['e1', project, skill]);
      }
    }

    const mvds = detectMultivaluedDependenciesFromData(['emp_id', 'project', 'skill'], rows);
    expect(mvds.length).toBeGreaterThan(0);
    expect(
      mvds.some((mvd) =>
        mvd.determinant.includes('emp_id') && (mvd.dependent.includes('project') || mvd.dependent.includes('skill')),
      ),
    ).toBe(true);
  });

  it('does not infer MVDs when the cross-product is incomplete', () => {
    const rows = [
      ['e1', 'p1', 'sql'],
      ['e1', 'p2', 'java'],
      ['e1', 'p3', 'python'],
    ];

    const mvds = detectMultivaluedDependenciesFromData(['emp_id', 'project', 'skill'], rows);
    expect(mvds).toHaveLength(0);
  });

  it('downgrades confidence to BCNF cap when explicit MVDs are absent and inference cannot run', () => {
    const table = makeTable({
      name: 'Tiny',
      columns: ['a', 'b', 'c'],
      primaryKey: ['a'],
      fds: [{ determinant: ['a'], dependent: ['b', 'c'] }],
      sampleData: [
        ['1', 'x', 'p'],
        ['2', 'y', 'q'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(['BCNF', '4NF', '5NF']).toContain(report.detectedNF);
    expect(report.confidence === 'medium' || report.confidence === 'high').toBe(true);
  });
});

describe('inferCandidateKeysFromData', () => {
  it('finds single-column candidate keys', () => {
    const keys = inferCandidateKeysFromData(['id', 'name'], [
      ['1', 'a'],
      ['2', 'b'],
      ['3', 'c'],
    ]);

    expect(keys).toContainEqual(['id']);
  });

  it('finds composite candidate keys when no single column is unique', () => {
    const keys = inferCandidateKeysFromData(['student', 'course', 'grade'], [
      ['s1', 'c1', 'A'],
      ['s1', 'c2', 'B'],
      ['s2', 'c1', 'A'],
    ]);

    expect(keys.length).toBeGreaterThan(0);
    expect(keys[0].length).toBeGreaterThanOrEqual(2);
  });

  it('returns an empty list when no rows exist', () => {
    expect(inferCandidateKeysFromData(['a', 'b'], [])).toHaveLength(0);
  });
});

describe('verifyNormalForm — production scenarios', () => {
  it('reproduces the original issue (2NF bridge table) and reports the correct NF', () => {
    const table = makeTable({
      name: 'StudentCourse',
      columns: ['student_id', 'course'],
      primaryKey: ['student_id', 'course'],
      sampleData: [
        ['1', 'DBMS'],
        ['1', 'OS'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).not.toBe('1NF');
    expect(report.detectedNF).not.toBe('UNF');
    expect(report.detectedNF).toBe('5NF');
  });

  it('handles wide datasets with explicit FDs and rich sample data', () => {
    const table = makeTable({
      name: 'OrderLine',
      columns: ['order_id', 'product_id', 'customer_id', 'customer_name', 'product_name', 'qty'],
      primaryKey: ['order_id', 'product_id'],
      fds: [
        { determinant: ['order_id'], dependent: ['customer_id', 'customer_name'] },
        { determinant: ['customer_id'], dependent: ['customer_name'] },
        { determinant: ['product_id'], dependent: ['product_name'] },
        { determinant: ['order_id', 'product_id'], dependent: ['qty'] },
      ],
      sampleData: [
        ['o1', 'p1', 'c1', 'Alice', 'Book', '2'],
        ['o1', 'p2', 'c1', 'Alice', 'Pen', '1'],
        ['o2', 'p1', 'c2', 'Bob', 'Book', '3'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('1NF');
    expect(report.violations.partial.length).toBeGreaterThan(0);
  });

  it('correctly classifies a perfectly-normalized customer table as 5NF', () => {
    const table = makeTable({
      name: 'Customer',
      columns: ['customer_id', 'name', 'email'],
      primaryKey: ['customer_id'],
      fds: [
        { determinant: ['customer_id'], dependent: ['name', 'email'] },
        { determinant: ['email'], dependent: ['customer_id', 'name'] },
      ],
      sampleData: [
        ['1', 'Alice', 'alice@example.com'],
        ['2', 'Bob', 'bob@example.com'],
        ['3', 'Carol', 'carol@example.com'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('5NF');
    expect(report.candidateKeys.length).toBeGreaterThanOrEqual(2);
  });

  it('detects partial dependency in a classic textbook order-detail schema', () => {
    const table = makeTable({
      name: 'OrderDetails',
      columns: ['order_id', 'item_id', 'quantity', 'item_name'],
      primaryKey: ['order_id', 'item_id'],
      fds: [
        { determinant: ['order_id', 'item_id'], dependent: ['quantity'] },
        { determinant: ['item_id'], dependent: ['item_name'] },
      ],
      sampleData: [
        ['o1', 'i1', '2', 'Book'],
        ['o1', 'i2', '1', 'Pen'],
        ['o2', 'i1', '3', 'Book'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('1NF');
    expect(report.violations.partial.length).toBeGreaterThan(0);
  });
});

describe('verifyNormalForm — backwards-compatible legacy strict shim', () => {
  it('exposes legacy fields without losing essential information', () => {
    const table = makeTable({
      name: 'Student',
      columns: ['id', 'name'],
      primaryKey: ['id'],
      fds: [{ determinant: ['id'], dependent: ['name'] }],
      sampleData: [
        ['1', 'Alice'],
        ['2', 'Bob'],
      ],
    });

    const legacy = verifyNormalFormStrict(table);
    expect(legacy).toMatchObject({
      detectedNF: expect.any(String),
      confidence: expect.any(String),
      warnings: expect.any(Array),
      evidence: {
        hasExplicitPrimaryKey: true,
        hasExplicitFDs: true,
        hasExplicitMVDs: false,
        hasExplicitJoinDependencies: false,
        sampleRowCount: 2,
      },
    });
  });

  it('produces the same detected NF as the rich verifier', () => {
    const table = makeTable({
      name: 'StudentCourse',
      columns: ['student_id', 'course'],
      primaryKey: ['student_id', 'course'],
      sampleData: [
        ['1', 'DBMS'],
        ['1', 'OS'],
      ],
    });

    const rich = verifyNormalForm(table);
    const legacy = verifyNormalFormStrict(table);

    expect(legacy.detectedNF).toBe(rich.detectedNF);
    expect(legacy.confidence).toBe(rich.confidence);
  });
});
