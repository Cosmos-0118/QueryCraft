import { NextRequest, NextResponse } from 'next/server';
import { getTestModuleTypeById, listLeaderboardEntries } from '@/lib/test/test-module-db';
import {
  ensureAttemptAccess,
  ensureStudentCanAccessTest,
  ensureTeacherOwnsTest,
  getLatestAttemptForActor,
  requireTestActor,
} from '@/lib/security/test-module-security';

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
    const actorResult = requireTestActor(req, {
      allowedRoles: ['admin', 'teacher', 'student'],
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const actor = actorResult.value;

    const testId = await resolveTestId(context);
    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    if (actor.role === 'teacher') {
      const ownership = await ensureTeacherOwnsTest(actor, testId);
      if (!ownership.ok) {
        return ownership.response;
      }
    }

    if (actor.role === 'student') {
      const access = await ensureStudentCanAccessTest(actor, testId);
      if (!access.ok) {
        return access.response;
      }
    }

    const moduleType = await getTestModuleTypeById(testId);
    if (!moduleType) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    }

    const requestedAttemptId = req.nextUrl.searchParams.get('attemptId') ?? undefined;
    let attemptIdForCurrentEntry = requestedAttemptId;

    if (actor.role === 'student') {
      if (requestedAttemptId) {
        const access = await ensureAttemptAccess(actor, {
          testId,
          attemptId: requestedAttemptId,
          allowTeacherOwner: false,
        });
        if (!access.ok) {
          attemptIdForCurrentEntry = undefined;
        }
      } else {
        const latest = await getLatestAttemptForActor(testId, actor);
        attemptIdForCurrentEntry = latest?.id;
      }
    }

    const leaderboard = (await listLeaderboardEntries(testId)).map((attempt, index) => ({
        rank: index + 1,
        attempt_id: attempt.attempt_id,
        student_id: attempt.student_id,
        student_name: attempt.student_name,
        points: attempt.points,
        submitted_at: attempt.submitted_at,
      }));

    const currentEntry = attemptIdForCurrentEntry
      ? leaderboard.find((entry) => entry.attempt_id === attemptIdForCurrentEntry) ?? null
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
