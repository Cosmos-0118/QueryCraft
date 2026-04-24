import { NextRequest, NextResponse } from 'next/server';
import { getTestById, listReviewSubmissions } from '@/lib/test/test-module-db';

async function resolveTestId(
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  const params = await Promise.resolve(context.params);
  return params.id;
}

// GET /api/tests/:id/leaderboard?attemptId=...
export async function GET(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  try {
    const testId = await resolveTestId(context);
    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    const test = await getTestById(testId);
    if (!test) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    }

    const attemptId = req.nextUrl.searchParams.get('attemptId') ?? undefined;

    const submissions = await listReviewSubmissions(testId);
    const leaderboard = submissions
      .filter((attempt) => attempt.status === 'submitted')
      .sort((left, right) => {
        const leftScore = left.score ?? 0;
        const rightScore = right.score ?? 0;

        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }

        const leftSubmitted = left.submitted_at ? new Date(left.submitted_at).getTime() : Number.MAX_SAFE_INTEGER;
        const rightSubmitted = right.submitted_at ? new Date(right.submitted_at).getTime() : Number.MAX_SAFE_INTEGER;
        return leftSubmitted - rightSubmitted;
      })
      .map((attempt, index) => ({
        rank: index + 1,
        attempt_id: attempt.id,
        student_id: attempt.student_id,
        student_name: attempt.student_name,
        points: Math.max(0, Math.round(attempt.score ?? 0)),
        submitted_at: attempt.submitted_at,
      }));

    const currentEntry = attemptId
      ? leaderboard.find((entry) => entry.attempt_id === attemptId) ?? null
      : null;

    return NextResponse.json(
      {
        leaderboard,
        total_participants: leaderboard.length,
        current_entry: currentEntry,
        module_type: test.module_type,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load leaderboard.' },
      { status: 400 },
    );
  }
}
