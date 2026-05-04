import { describe, expect, it } from 'vitest';
import {
  decomposeTo3NF,
  verifyDependencyPreservation,
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

describe('normalizer verifyDependencyPreservation', () => {
  it('returns true when original FD set is empty', () => {
    const decomposed = [
      makeTable({ name: 'R1', columns: ['A', 'B'], fds: [] }),
    ];

    expect(verifyDependencyPreservation([], decomposed)).toBe(true);
  });

  it('returns true when dependencies are directly present in decomposed relations', () => {
    const originalFDs: FunctionalDependency[] = [
      { determinant: ['A'], dependent: ['B'] },
      { determinant: ['B'], dependent: ['C'] },
    ];

    const decomposed = [
      makeTable({
        name: 'R1',
        columns: ['A', 'B'],
        fds: [{ determinant: ['A'], dependent: ['B'] }],
      }),
      makeTable({
        name: 'R2',
        columns: ['B', 'C'],
        fds: [{ determinant: ['B'], dependent: ['C'] }],
      }),
    ];

    expect(verifyDependencyPreservation(originalFDs, decomposed)).toBe(true);
  });

  it('returns true when dependencies are preserved through closure (transitive inference)', () => {
    const originalFDs: FunctionalDependency[] = [
      { determinant: ['A'], dependent: ['C'] },
    ];

    const decomposed = [
      makeTable({
        name: 'R1',
        columns: ['A', 'B'],
        fds: [{ determinant: ['A'], dependent: ['B'] }],
      }),
      makeTable({
        name: 'R2',
        columns: ['B', 'C'],
        fds: [{ determinant: ['B'], dependent: ['C'] }],
      }),
    ];

    expect(verifyDependencyPreservation(originalFDs, decomposed)).toBe(true);
  });

  it('handles multi-attribute dependents split across decomposed relations', () => {
    const originalFDs: FunctionalDependency[] = [
      { determinant: ['A'], dependent: ['B', 'C'] },
    ];

    const decomposed = [
      makeTable({
        name: 'R1',
        columns: ['A', 'B'],
        fds: [{ determinant: ['A'], dependent: ['B'] }],
      }),
      makeTable({
        name: 'R2',
        columns: ['A', 'C'],
        fds: [{ determinant: ['A'], dependent: ['C'] }],
      }),
    ];

    expect(verifyDependencyPreservation(originalFDs, decomposed)).toBe(true);
  });

  it('returns false when one required dependent attribute is not preserved', () => {
    const originalFDs: FunctionalDependency[] = [
      { determinant: ['A'], dependent: ['B', 'C'] },
    ];

    const decomposed = [
      makeTable({
        name: 'R1',
        columns: ['A', 'B'],
        fds: [{ determinant: ['A'], dependent: ['B'] }],
      }),
    ];

    expect(verifyDependencyPreservation(originalFDs, decomposed)).toBe(false);
  });

  it('returns false when projected dependencies cannot derive original composite dependency', () => {
    const originalFDs: FunctionalDependency[] = [
      { determinant: ['A', 'B'], dependent: ['C'] },
    ];

    const decomposed = [
      makeTable({
        name: 'R1',
        columns: ['A', 'D'],
        fds: [{ determinant: ['A'], dependent: ['D'] }],
      }),
      makeTable({
        name: 'R2',
        columns: ['B', 'E'],
        fds: [{ determinant: ['B'], dependent: ['E'] }],
      }),
    ];

    expect(verifyDependencyPreservation(originalFDs, decomposed)).toBe(false);
  });

  it('returns true when redundant original dependencies are still inferable', () => {
    const originalFDs: FunctionalDependency[] = [
      { determinant: ['A'], dependent: ['B'] },
      { determinant: ['B'], dependent: ['C'] },
      { determinant: ['A'], dependent: ['C'] },
    ];

    const decomposed = [
      makeTable({
        name: 'R1',
        columns: ['A', 'B'],
        fds: [{ determinant: ['A'], dependent: ['B'] }],
      }),
      makeTable({
        name: 'R2',
        columns: ['B', 'C'],
        fds: [{ determinant: ['B'], dependent: ['C'] }],
      }),
    ];

    expect(verifyDependencyPreservation(originalFDs, decomposed)).toBe(true);
  });

  it('returns false for a canonical non-preserving decomposition example', () => {
    const originalFDs: FunctionalDependency[] = [
      { determinant: ['A', 'B'], dependent: ['C'] },
      { determinant: ['C'], dependent: ['B'] },
    ];

    const nonPreserving = [
      makeTable({
        name: 'CB',
        columns: ['C', 'B'],
        fds: [{ determinant: ['C'], dependent: ['B'] }],
      }),
      makeTable({
        name: 'AC',
        columns: ['A', 'C'],
        fds: [],
      }),
    ];

    expect(verifyDependencyPreservation(originalFDs, nonPreserving)).toBe(false);
  });

  it('remains true for 3NF synthesis on transitive dependency schema', () => {
    const original = makeTable({
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

    const decomposed = decomposeTo3NF([original]);

    expect(verifyDependencyPreservation(original.fds, decomposed)).toBe(true);
  });
});
