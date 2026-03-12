import type { Exercise, GradingResult } from '@/types/exercise';

/**
 * Normalize a result set for comparison:
 * - Trim whitespace, lowercase
 * - Sort rows for order-independent comparison
 */
function normalizeResultSet(rows: string[][]): string[][] {
  return rows
    .map((row) => row.map((cell) => String(cell ?? '').trim().toLowerCase()))
    .sort((a, b) => a.join('|').localeCompare(b.join('|')));
}

function arraysEqual(a: string[][], b: string[][]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    if (row.length !== b[i].length) return false;
    return row.every((cell, j) => cell === b[i][j]);
  });
}

export function gradeExercise(
  exercise: Exercise,
  actualResult: string[][],
): GradingResult {
  if (!exercise.expectedResult) {
    return {
      isCorrect: false,
      feedback: 'This exercise cannot be auto-graded (no expected result defined).',
    };
  }

  const normalizedExpected = normalizeResultSet(exercise.expectedResult);
  const normalizedActual = normalizeResultSet(actualResult);

  const isCorrect = arraysEqual(normalizedExpected, normalizedActual);

  if (isCorrect) {
    return {
      isCorrect: true,
      feedback: 'Correct! Your query produced the expected result.',
      expected: exercise.expectedResult,
      actual: actualResult,
    };
  }

  // Provide helpful feedback
  let feedback = 'Incorrect. ';
  if (normalizedActual.length !== normalizedExpected.length) {
    feedback += `Expected ${normalizedExpected.length} row(s) but got ${normalizedActual.length}. `;
  } else if (normalizedActual[0]?.length !== normalizedExpected[0]?.length) {
    feedback += `Expected ${normalizedExpected[0]?.length ?? 0} column(s) but got ${normalizedActual[0]?.length ?? 0}. `;
  } else {
    feedback += 'The values don\'t match the expected result. ';
  }
  feedback += 'Check the expected vs actual comparison below.';

  return {
    isCorrect: false,
    feedback,
    expected: exercise.expectedResult,
    actual: actualResult,
  };
}
