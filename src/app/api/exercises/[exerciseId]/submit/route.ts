import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { exerciseSubmissions } from '@/lib/db/schema';
import { getExerciseById } from '@/lib/exercises/exercise-bank';
import { gradeExercise } from '@/lib/exercises/validator';
import { sanitizeInput } from '@/lib/security/input-sanitizer';
import { eq, and, count } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ exerciseId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (isAuthError(auth)) return auth;

    const { exerciseId } = await params;
    const exercise = getExerciseById(exerciseId);
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
    }

    const body = await request.json();
    const answer = typeof body.answer === 'string' ? sanitizeInput(body.answer, 5000) : '';
    if (!answer.trim()) {
      return NextResponse.json({ error: 'Answer is required' }, { status: 400 });
    }

    // Grade the submission
    // For SQL exercises with expectedResult, parse the provided actualResult rows
    // The client sends `actualResult` (2D array) after executing the query client-side
    let gradingResult;
    if (exercise.type === 'sql' && exercise.expectedResult && Array.isArray(body.actualResult)) {
      const actualRows: string[][] = (body.actualResult as unknown[][]).map((row: unknown[]) =>
        row.map((cell) => String(cell ?? '')),
      );
      gradingResult = gradeExercise(exercise, actualRows);
    } else {
      // Non-SQL or no expectedResult: compare answer string against last hint (solution)
      const solution = exercise.hints[exercise.hints.length - 1] ?? '';
      const normalize = (s: string) =>
        s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/;$/, '');
      const isCorrect = normalize(answer) === normalize(solution);
      gradingResult = {
        isCorrect,
        feedback: isCorrect
          ? 'Correct! Well done.'
          : 'Not quite. Review your answer and check the hints for guidance.',
        expected: exercise.expectedResult,
      };
    }

    // Get current attempt count for this user+exercise
    const [attemptRow] = await db
      .select({ cnt: count() })
      .from(exerciseSubmissions)
      .where(
        and(
          eq(exerciseSubmissions.userId, auth.userId),
          eq(exerciseSubmissions.exerciseId, exerciseId),
        ),
      );
    const attemptNumber = (attemptRow?.cnt ?? 0) + 1;

    // Persist submission
    await db.insert(exerciseSubmissions).values({
      userId: auth.userId,
      exerciseId,
      submittedAnswer: answer,
      isCorrect: gradingResult.isCorrect,
      attemptNumber,
    });

    return NextResponse.json({
      ...gradingResult,
      attemptNumber,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
