import { NextRequest, NextResponse } from 'next/server';
import { getTestModuleTypeById, listLeaderboardEntries } from '@/lib/test/test-module-db';

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

    const moduleType = await getTestModuleTypeById(testId);
    if (!moduleType) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    }

    const attemptId = req.nextUrl.searchParams.get('attemptId') ?? undefined;

    const leaderboard = (await listLeaderboardEntries(testId)).map((attempt, index) => ({
        rank: index + 1,
        attempt_id: attempt.attempt_id,
        student_id: attempt.student_id,
        student_name: attempt.student_name,
        points: attempt.points,
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
        module_type: moduleType,
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
