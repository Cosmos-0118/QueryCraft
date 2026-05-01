import { describe, expect, it } from 'vitest';
import { verifyNormalForm } from '@/lib/engine/normalizer-engine';
import type { FunctionalDependency, TableSchema } from '@/types/normalizer';

function makeTable(args: {
  name: string;
  columns: string[];
  primaryKey?: string[];
  fds?: FunctionalDependency[];
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
    mvds: [],
    sampleData: args.sampleData,
  };
}

describe('verifyNormalForm — FD inference with explicit primary keys', () => {
  const userIssueRows = [
    ['1', 'Alice', 'CS', 'DBMS'],
    ['1', 'Alice', 'CS', 'OS'],
    ['2', 'Bob', 'IT', 'CN'],
    ['3', 'Charlie', 'ECE', 'VLSI'],
    ['3', 'Charlie', 'ECE', 'Signals'],
  ];

  it('detects partial dependencies when only a broad PK->all FD is present', () => {
    const table = makeTable({
      name: 'EnrollmentLike',
      columns: ['student_id', 'student_name', 'department', 'course'],
      primaryKey: ['student_id', 'course'],
      fds: [{
        determinant: ['student_id', 'course'],
        dependent: ['student_name', 'department'],
      }],
      sampleData: userIssueRows,
    });

    const report = verifyNormalForm(table);

    expect(report.detectedNF).toBe('1NF');
    expect(report.violations.partial.length).toBeGreaterThan(0);
    expect(report.evidence.hasInferredFDs).toBe(true);
  });

  it('detects the same partial dependency when no explicit FDs are provided', () => {
    const table = makeTable({
      name: 'EnrollmentNoFD',
      columns: ['student_id', 'student_name', 'department', 'course'],
      primaryKey: ['student_id', 'course'],
      sampleData: userIssueRows,
    });

    const report = verifyNormalForm(table);

    expect(report.detectedNF).toBe('1NF');
    expect(report.violations.partial.length).toBeGreaterThan(0);
    expect(report.evidence.hasInferredFDs).toBe(true);
  });

  it('keeps strict mode inference-free even when a PK exists', () => {
    const table = makeTable({
      name: 'StrictEnrollment',
      columns: ['student_id', 'student_name', 'department', 'course'],
      primaryKey: ['student_id', 'course'],
      sampleData: userIssueRows,
    });

    const report = verifyNormalForm(table, { mode: 'strict' });

    expect(report.evidence.hasInferredFDs).toBe(false);
    expect(report.violations.partial).toHaveLength(0);
  });

  it('does not infer FDs for explicit PK tables with too few rows', () => {
    const table = makeTable({
      name: 'TinyEnrollment',
      columns: ['student_id', 'student_name', 'department', 'course'],
      primaryKey: ['student_id', 'course'],
      sampleData: [
        ['1', 'Alice', 'CS', 'DBMS'],
        ['2', 'Bob', 'IT', 'CN'],
      ],
    });

    const report = verifyNormalForm(table);

    expect(report.evidence.hasInferredFDs).toBe(false);
  });

  it('preserves explicit non-scaffold FDs as authoritative', () => {
    const table = makeTable({
      name: 'ExplicitFD',
      columns: ['student_id', 'course', 'student_name'],
      primaryKey: ['student_id', 'course'],
      fds: [{ determinant: ['student_id'], dependent: ['student_name'] }],
      sampleData: [
        ['1', 'DBMS', 'Alice'],
        ['1', 'OS', 'Alice'],
        ['2', 'CN', 'Bob'],
      ],
    });

    const report = verifyNormalForm(table);

    expect(report.evidence.hasExplicitFDs).toBe(true);
    expect(report.violations.partial.length).toBeGreaterThan(0);
    expect(report.confidence).toBe('high');
  });

  it('still infers FDs for non-PK tables with 2 sample rows', () => {
    const table = makeTable({
      name: 'TwoRowsNoPk',
      columns: ['id', 'name'],
      sampleData: [
        ['1', 'Alice'],
        ['2', 'Bob'],
      ],
    });

    const report = verifyNormalForm(table);
    expect(report.evidence.hasInferredFDs).toBe(true);
  });
});
