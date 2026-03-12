import { describe, it, expect } from 'vitest';
import { gradeExercise } from '@/lib/exercises/validator';
import type { Exercise } from '@/types/exercise';

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'test-001',
    title: 'Test Exercise',
    description: 'A test exercise',
    type: 'sql',
    difficulty: 'easy',
    topicSlug: 'sql',
    hints: ['hint 1', 'hint 2', 'SELECT * FROM t;'],
    expectedResult: [
      ['1', 'Alice'],
      ['2', 'Bob'],
    ],
    ...overrides,
  };
}

describe('gradeExercise', () => {
  it('returns correct for exact match', () => {
    const exercise = makeExercise();
    const result = gradeExercise(exercise, [
      ['1', 'Alice'],
      ['2', 'Bob'],
    ]);
    expect(result.isCorrect).toBe(true);
    expect(result.feedback).toContain('Correct');
  });

  it('returns correct for same rows in different order', () => {
    const exercise = makeExercise();
    const result = gradeExercise(exercise, [
      ['2', 'Bob'],
      ['1', 'Alice'],
    ]);
    expect(result.isCorrect).toBe(true);
  });

  it('is case-insensitive', () => {
    const exercise = makeExercise();
    const result = gradeExercise(exercise, [
      ['1', 'alice'],
      ['2', 'bob'],
    ]);
    expect(result.isCorrect).toBe(true);
  });

  it('trims whitespace in cells', () => {
    const exercise = makeExercise();
    const result = gradeExercise(exercise, [
      ['1', '  Alice  '],
      [' 2 ', 'Bob'],
    ]);
    expect(result.isCorrect).toBe(true);
  });

  it('returns incorrect for wrong row count', () => {
    const exercise = makeExercise();
    const result = gradeExercise(exercise, [['1', 'Alice']]);
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toContain('row');
  });

  it('returns incorrect for wrong column count', () => {
    const exercise = makeExercise();
    const result = gradeExercise(exercise, [
      ['1', 'Alice', 'extra'],
      ['2', 'Bob', 'extra'],
    ]);
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toContain('column');
  });

  it('returns incorrect for wrong values', () => {
    const exercise = makeExercise();
    const result = gradeExercise(exercise, [
      ['1', 'Alice'],
      ['2', 'Charlie'],
    ]);
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toContain("don't match");
  });

  it('returns incorrect when no expected result is defined', () => {
    const exercise = makeExercise({ expectedResult: undefined });
    const result = gradeExercise(exercise, [['anything']]);
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toContain('cannot be auto-graded');
  });

  it('handles empty result sets', () => {
    const exercise = makeExercise({ expectedResult: [] });
    const result = gradeExercise(exercise, []);
    expect(result.isCorrect).toBe(true);
  });

  it('handles null/undefined cell values gracefully', () => {
    const exercise = makeExercise({
      expectedResult: [['1', '']],
    });
    const result = gradeExercise(exercise, [['1', '']]);
    expect(result.isCorrect).toBe(true);
  });

  it('includes expected and actual in result when correct', () => {
    const exercise = makeExercise();
    const actual = [
      ['1', 'Alice'],
      ['2', 'Bob'],
    ];
    const result = gradeExercise(exercise, actual);
    expect(result.expected).toBeDefined();
    expect(result.actual).toBeDefined();
  });

  it('includes expected and actual in result when incorrect', () => {
    const exercise = makeExercise();
    const actual = [['wrong']];
    const result = gradeExercise(exercise, actual);
    expect(result.expected).toBeDefined();
    expect(result.actual).toBeDefined();
  });
});
