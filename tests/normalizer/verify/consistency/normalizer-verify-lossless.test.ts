import { describe, expect, it } from 'vitest';
import { verifyLosslessJoin } from '@/lib/engine/normalizer-engine';
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

describe('normalizer verifyLosslessJoin', () => {
  it('returns true when original table has no sample data', () => {
    const original = makeTable({
      name: 'NoData',
      columns: ['A', 'B', 'C'],
    });

    expect(verifyLosslessJoin(original, [])).toBe(true);
  });

  it('returns false when decomposition list is empty for non-empty original', () => {
    const original = makeTable({
      name: 'Simple',
      columns: ['A', 'B'],
      sampleData: [
        ['1', 'x'],
        ['2', 'y'],
      ],
    });

    expect(verifyLosslessJoin(original, [])).toBe(false);
  });

  it('passes for textbook key-based decomposition', () => {
    const original = makeTable({
      name: 'Enrollment',
      columns: ['student_id', 'course_id', 'student_name', 'course_title', 'grade'],
      sampleData: [
        ['1', '10', 'Alice', 'DBMS', 'A'],
        ['1', '11', 'Alice', 'Algo', 'B+'],
        ['2', '10', 'Bob', 'DBMS', 'A-'],
      ],
    });

    const decomposed = [
      makeTable({ name: 'Students', columns: ['student_id', 'student_name'] }),
      makeTable({ name: 'Courses', columns: ['course_id', 'course_title'] }),
      makeTable({ name: 'Enrollments', columns: ['student_id', 'course_id', 'grade'] }),
    ];

    expect(verifyLosslessJoin(original, decomposed)).toBe(true);
  });

  it('fails for lossy decomposition that creates spurious tuples', () => {
    const original = makeTable({
      name: 'R',
      columns: ['A', 'B', 'C'],
      sampleData: [
        ['a1', 'b1', 'c1'],
        ['a1', 'b2', 'c2'],
      ],
    });

    const lossy = [
      makeTable({ name: 'AB', columns: ['A', 'B'] }),
      makeTable({ name: 'AC', columns: ['A', 'C'] }),
    ];

    expect(verifyLosslessJoin(original, lossy)).toBe(false);
  });

  it('passes for multi-table decomposition when shared key remains unique', () => {
    const original = makeTable({
      name: 'ABCD',
      columns: ['A', 'B', 'C', 'D'],
      sampleData: [
        ['1', 'x', 'p', 'u'],
        ['2', 'y', 'q', 'v'],
        ['3', 'z', 'r', 'w'],
      ],
    });

    const decomposed = [
      makeTable({ name: 'AB', columns: ['A', 'B'] }),
      makeTable({ name: 'AC', columns: ['A', 'C'] }),
      makeTable({ name: 'AD', columns: ['A', 'D'] }),
    ];

    expect(verifyLosslessJoin(original, decomposed)).toBe(true);
  });

  it('is insensitive to decomposed table column order', () => {
    const original = makeTable({
      name: 'Enrollment',
      columns: ['student_id', 'course_id', 'student_name', 'course_title', 'grade'],
      sampleData: [
        ['1', '10', 'Alice', 'DBMS', 'A'],
        ['1', '11', 'Alice', 'Algo', 'B+'],
        ['2', '10', 'Bob', 'DBMS', 'A-'],
      ],
    });

    const reordered = [
      makeTable({ name: 'Enrollments', columns: ['course_id', 'student_id', 'grade'] }),
      makeTable({ name: 'Students', columns: ['student_name', 'student_id'] }),
      makeTable({ name: 'Courses', columns: ['course_title', 'course_id'] }),
    ];

    expect(verifyLosslessJoin(original, reordered)).toBe(true);
  });

  it('fails when decomposition omits required attributes', () => {
    const original = makeTable({
      name: 'R',
      columns: ['A', 'B', 'C'],
      sampleData: [
        ['1', 'x', 'p'],
        ['2', 'y', 'q'],
      ],
    });

    const incomplete = [
      makeTable({ name: 'AB', columns: ['A', 'B'] }),
    ];

    expect(verifyLosslessJoin(original, incomplete)).toBe(false);
  });

  it('fails for disjoint projections that produce cartesian product', () => {
    const original = makeTable({
      name: 'R',
      columns: ['A', 'B'],
      sampleData: [
        ['1', 'x'],
        ['2', 'y'],
      ],
    });

    const disjoint = [
      makeTable({ name: 'OnlyA', columns: ['A'] }),
      makeTable({ name: 'OnlyB', columns: ['B'] }),
    ];

    expect(verifyLosslessJoin(original, disjoint)).toBe(false);
  });
});
