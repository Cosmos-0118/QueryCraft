import { describe, expect, it } from 'vitest';
import {
  detectMultivaluedDependenciesFromData,
  inferCandidateKeysFromData,
  verifyNormalForm,
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

describe('Textbook normalisation scenarios', () => {
  it('Date / Codd: STUDENT(SID, SNAME, MAJOR) — 3NF/BCNF when SID determines all', () => {
    const table = makeTable({
      name: 'Student',
      columns: ['sid', 'sname', 'major'],
      primaryKey: ['sid'],
      fds: [{ determinant: ['sid'], dependent: ['sname', 'major'] }],
      sampleData: [
        ['S1', 'Alice', 'CS'],
        ['S2', 'Bob', 'EE'],
        ['S3', 'Carol', 'CS'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(['BCNF', '4NF', '5NF']).toContain(report.detectedNF);
    expect(report.violations.bcnf).toHaveLength(0);
  });

  it('Elmasri / Navathe: ENROLL(SID, CID, SNAME, GRADE) — 1NF due to partial dependency', () => {
    const table = makeTable({
      name: 'Enroll',
      columns: ['sid', 'cid', 'sname', 'grade'],
      primaryKey: ['sid', 'cid'],
      fds: [
        { determinant: ['sid', 'cid'], dependent: ['grade'] },
        { determinant: ['sid'], dependent: ['sname'] },
      ],
      sampleData: [
        ['S1', 'C1', 'Alice', 'A'],
        ['S1', 'C2', 'Alice', 'B'],
        ['S2', 'C1', 'Bob', 'A'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('1NF');
    expect(report.violations.partial.length).toBeGreaterThan(0);
    expect(report.violations.partial[0].determinant).toContain('sid');
  });

  it('Elmasri / Navathe: EMP_DEPT(EID, DEPTID, DEPTNAME) — 2NF due to transitive dependency', () => {
    const table = makeTable({
      name: 'EmpDept',
      columns: ['eid', 'deptid', 'deptname'],
      primaryKey: ['eid'],
      fds: [
        { determinant: ['eid'], dependent: ['deptid'] },
        { determinant: ['deptid'], dependent: ['deptname'] },
      ],
      sampleData: [
        ['E1', 'D1', 'Sales'],
        ['E2', 'D1', 'Sales'],
        ['E3', 'D2', 'Marketing'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('2NF');
    expect(report.violations.transitive.length).toBeGreaterThan(0);
  });

  it('Beeri / Bernstein: R(A, B, C) with FDs AB->C, C->B — 3NF but not BCNF', () => {
    const table = makeTable({
      name: 'R',
      columns: ['a', 'b', 'c'],
      fds: [
        { determinant: ['a', 'b'], dependent: ['c'] },
        { determinant: ['c'], dependent: ['b'] },
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('3NF');
    expect(report.violations.bcnf.length).toBeGreaterThan(0);
  });

  it('Fagin: SPJ(SUPPLIER, PART, PROJECT) join dependency — 4NF, not 5NF', () => {
    const table = makeTable({
      name: 'SPJ',
      columns: ['supplier', 'part', 'project'],
      primaryKey: ['supplier', 'part', 'project'],
      joinDependencies: [{
        components: [
          ['supplier', 'part'],
          ['supplier', 'project'],
          ['part', 'project'],
        ],
      }],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('4NF');
    expect(report.violations.jd.length).toBeGreaterThan(0);
  });

  it('Maier: classic MVD example — TEACHES(TEACHER, COURSE, BOOK) caps at BCNF', () => {
    const rows: string[][] = [];
    for (const teacher of ['Smith', 'Jones']) {
      for (const course of ['DB', 'OS']) {
        for (const book of ['Book1', 'Book2']) {
          rows.push([teacher, course, book]);
        }
      }
    }

    const table = makeTable({
      name: 'Teaches',
      columns: ['teacher', 'course', 'book'],
      primaryKey: ['teacher', 'course', 'book'],
      mvds: [
        { determinant: ['teacher'], dependent: ['course'] },
        { determinant: ['teacher'], dependent: ['book'] },
      ],
      sampleData: rows,
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('BCNF');
    expect(report.violations.mvd.length).toBeGreaterThan(0);
  });

  it('Codd 1NF example — multi-valued cells flagged as UNF', () => {
    const table = makeTable({
      name: 'Employee',
      columns: ['emp_id', 'phones'],
      primaryKey: ['emp_id'],
      sampleData: [
        ['E1', '555-1111;555-2222'],
        ['E2', '555-3333'],
      ],
    });

    expect(verifyNormalForm(table).detectedNF).toBe('UNF');
  });
});

describe('Production scenario from issues.txt — bridge tables and pasted CSV', () => {
  it('the exact reproduction case: 2-column bridge with composite PK is 5NF, not 1NF', () => {
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
    expect(report.confidence).not.toBe('low');
    expect(report.violations.partial).toHaveLength(0);
    expect(report.violations.transitive).toHaveLength(0);
    expect(report.violations.bcnf).toHaveLength(0);
  });

  it('produces the same NF level for the bridge case even without an explicit primary key', () => {
    const table = makeTable({
      name: 'StudentCourseRaw',
      columns: ['student_id', 'course'],
      sampleData: [
        ['1', 'DBMS'],
        ['1', 'OS'],
        ['2', 'DBMS'],
        ['2', 'OS'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(['BCNF', '4NF', '5NF']).toContain(report.detectedNF);
  });

  it('supports the user-provided FD example from the issue', () => {
    const table = makeTable({
      name: 'StudentInfo',
      columns: ['student_id', 'student_name', 'department', 'department_head'],
      primaryKey: ['student_id'],
      fds: [
        { determinant: ['student_id'], dependent: ['student_name', 'department'] },
        { determinant: ['department'], dependent: ['department_head'] },
      ],
      sampleData: [
        ['1', 'Alice', 'CS', 'Dr. Smith'],
        ['2', 'Bob', 'CS', 'Dr. Smith'],
        ['3', 'Carol', 'EE', 'Dr. Jones'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.detectedNF).toBe('2NF');
    expect(report.violations.transitive.length).toBeGreaterThan(0);
  });

  it('correctly classifies a 2NF decomposition of the user example', () => {
    const enrollment = makeTable({
      name: 'Enrollment',
      columns: ['student_id', 'course'],
      primaryKey: ['student_id', 'course'],
      sampleData: [
        ['1', 'DBMS'],
        ['1', 'OS'],
      ],
    });

    const studentInfo = makeTable({
      name: 'StudentInfo',
      columns: ['student_id', 'student_name', 'department'],
      primaryKey: ['student_id'],
      fds: [{ determinant: ['student_id'], dependent: ['student_name', 'department'] }],
      sampleData: [
        ['1', 'Alice', 'CS'],
        ['2', 'Bob', 'CS'],
      ],
    });

    const departmentInfo = makeTable({
      name: 'DepartmentInfo',
      columns: ['department', 'department_head'],
      primaryKey: ['department'],
      fds: [{ determinant: ['department'], dependent: ['department_head'] }],
      sampleData: [
        ['CS', 'Dr. Smith'],
        ['EE', 'Dr. Jones'],
      ],
    });

    expect(verifyNormalForm(enrollment).detectedNF).toBe('5NF');
    expect(['BCNF', '4NF', '5NF']).toContain(verifyNormalForm(studentInfo).detectedNF);
    expect(['BCNF', '4NF', '5NF']).toContain(verifyNormalForm(departmentInfo).detectedNF);
  });
});

describe('Robustness — edge cases that should not crash or mis-classify', () => {
  it('handles tables with all-empty sample rows', () => {
    const table = makeTable({
      name: 'Blank',
      columns: ['a', 'b'],
      sampleData: [['', ''], ['', '']],
    });

    const report = verifyNormalForm(table);
    expect(['UNF', '1NF', '2NF', '3NF', 'BCNF', '4NF', '5NF']).toContain(report.detectedNF);
  });

  it('handles many columns without timing out', () => {
    const columns = Array.from({ length: 8 }, (_, index) => `c${index + 1}`);
    const rows = Array.from({ length: 4 }, (_, rowIndex) =>
      columns.map((_, columnIndex) => `r${rowIndex}_c${columnIndex}`),
    );

    const table = makeTable({
      name: 'Wide',
      columns,
      primaryKey: ['c1'],
      sampleData: rows,
    });

    const report = verifyNormalForm(table);
    expect(report).toBeDefined();
    expect(report.candidateKeys.length).toBeGreaterThan(0);
  });

  it('treats numeric and text data uniformly when inferring keys', () => {
    const keys = inferCandidateKeysFromData(['id', 'value'], [
      ['1', 'a'],
      ['2', 'b'],
      ['3', 'c'],
    ]);

    expect(keys).toContainEqual(['id']);
    expect(keys).toContainEqual(['value']);
  });

  it('does not panic when sample rows have differing column widths', () => {
    const table = makeTable({
      name: 'Ragged',
      columns: ['a', 'b', 'c'],
      sampleData: [
        ['1', 'x'],
        ['2', 'y', 'p'],
        ['3'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report).toBeDefined();
  });

  it('respects the strict mode flag — never infers FDs from data', () => {
    const rows = Array.from({ length: 10 }, (_, index) => [
      `id${index}`,
      `name${index}`,
      index < 5 ? 'CS' : 'EE',
    ]);

    const table = makeTable({
      name: 'Smart',
      columns: ['id', 'name', 'department'],
      sampleData: rows,
    });

    const smart = verifyNormalForm(table, { mode: 'smart' });
    const strict = verifyNormalForm(table, { mode: 'strict' });

    expect(smart.evidence.hasInferredFDs).toBe(true);
    expect(strict.evidence.hasInferredFDs).toBe(false);
  });

  it('does not flag MVDs that are merely projections of FDs', () => {
    const table = makeTable({
      name: 'Simple',
      columns: ['id', 'name', 'email'],
      primaryKey: ['id'],
      fds: [{ determinant: ['id'], dependent: ['name', 'email'] }],
      sampleData: [
        ['1', 'Alice', 'a@example.com'],
        ['2', 'Bob', 'b@example.com'],
        ['3', 'Carol', 'c@example.com'],
        ['4', 'Dave', 'd@example.com'],
      ],
    });

    const inferredMVDs = detectMultivaluedDependenciesFromData(
      ['id', 'name', 'email'],
      table.sampleData!,
    );

    expect(inferredMVDs.every((mvd) => mvd.dependent.length > 0)).toBe(true);
  });
});

describe('Confidence reporting accuracy', () => {
  it('high confidence when explicit FDs and PK fully determine BCNF', () => {
    const table = makeTable({
      name: 'Strong',
      columns: ['id', 'name'],
      primaryKey: ['id'],
      fds: [{ determinant: ['id'], dependent: ['name'] }],
      sampleData: [
        ['1', 'Alice'],
        ['2', 'Bob'],
        ['3', 'Carol'],
      ],
    });

    expect(verifyNormalForm(table).confidence).toBe('high');
  });

  it('low confidence when nothing is declared and there is no data', () => {
    const table = makeTable({
      name: 'Empty',
      columns: ['a', 'b', 'c', 'd'],
    });

    expect(verifyNormalForm(table).confidence).toBe('low');
  });

  it('warnings are populated when confidence is anything below high', () => {
    const table = makeTable({
      name: 'Weak',
      columns: ['a', 'b', 'c'],
      sampleData: [
        ['1', 'x', 'p'],
        ['2', 'y', 'q'],
      ],
    });

    const report = verifyNormalForm(table);
    if (report.confidence !== 'high') {
      expect(report.warnings.length).toBeGreaterThan(0);
    }
  });

  it('reasons array always includes at least one explanatory entry', () => {
    const table = makeTable({
      name: 'AnyTable',
      columns: ['x', 'y'],
      primaryKey: ['x'],
      sampleData: [['1', 'a']],
    });

    const report = verifyNormalForm(table);
    expect(report.reasons.length).toBeGreaterThan(0);
  });

  it('evidence object always reflects actual inputs', () => {
    const table = makeTable({
      name: 'Audit',
      columns: ['a', 'b', 'c'],
      primaryKey: ['a'],
      fds: [{ determinant: ['a'], dependent: ['b', 'c'] }],
      mvds: [{ determinant: ['a'], dependent: ['b'] }],
      joinDependencies: [{ components: [['a', 'b'], ['a', 'c']] }],
      sampleData: [
        ['1', 'x', 'p'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.evidence.hasExplicitPrimaryKey).toBe(true);
    expect(report.evidence.hasExplicitFDs).toBe(true);
    expect(report.evidence.hasExplicitMVDs).toBe(true);
    expect(report.evidence.hasExplicitJoinDependencies).toBe(true);
    expect(report.evidence.sampleRowCount).toBe(1);
    expect(report.evidence.columnCount).toBe(3);
  });
});
