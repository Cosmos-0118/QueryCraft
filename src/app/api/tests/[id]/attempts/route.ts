import { NextRequest, NextResponse } from 'next/server';
import {
  getLatestAttemptForStudent,
  startOrResumeAttempt,
} from '@/lib/test/test-module-db';
import {
  ensureAttemptAccess,
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

// GET /api/tests/:id/attempts?studentId=...&attemptId=...
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

    const attemptId = req.nextUrl.searchParams.get('attemptId');

    if (attemptId) {
      const access = await ensureAttemptAccess(actor, {
        testId,
        attemptId,
        allowTeacherOwner: true,
      });

      if (!access.ok) {
        return access.response;
      }

      return NextResponse.json({ attempt: access.value }, { status: 200 });
    }

    if (actor.role === 'student') {
      const attempt = await getLatestAttemptForActor(testId, actor);
      return NextResponse.json({ attempt }, { status: 200 });
    }

    if (actor.role === 'teacher') {
      const ownership = await ensureTeacherOwnsTest(actor, testId);
      if (!ownership.ok) {
        return ownership.response;
      }
    }

    const studentIdParam = req.nextUrl.searchParams.get('studentId')?.trim();
    if (!studentIdParam) {
      return NextResponse.json({ error: 'studentId is required for teacher/admin lookup.' }, { status: 400 });
    }

    const attempt = await getLatestAttemptForStudent(testId, studentIdParam.toLowerCase());
    return NextResponse.json({ attempt }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load attempt.' },
      { status: 500 },
    );
  }
}

// POST /api/tests/:id/attempts
export async function POST(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  try {
    const actorResult = requireTestActor(req, {
      allowedRoles: ['student'],
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const actor = actorResult.value;

    const testId = await resolveTestId(context);
    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    const existing = await getLatestAttemptForActor(testId, actor);
    if (existing) {
      return NextResponse.json({ attempt: existing }, { status: 200 });
    }

    // Body is optional for backward compatibility with older clients.
    await req.json().catch(() => null);

    try {
      const attempt = await startOrResumeAttempt({
        testId,
        studentId: actor.primaryUserId,
        studentName: actor.displayName,
      });

      return NextResponse.json({ attempt }, { status: 200 });
    } catch (primaryError) {
      const fallbackId = actor.userIdAliases.find((candidate) => candidate !== actor.primaryUserId);

      if (fallbackId) {
        try {
          const fallbackAttempt = await startOrResumeAttempt({
            testId,
            studentId: fallbackId,
            studentName: actor.displayName,
          });

          return NextResponse.json({ attempt: fallbackAttempt }, { status: 200 });
        } catch {
          throw primaryError;
        }
      }

      throw primaryError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start attempt.';
    const status = message.toLowerCase().includes('code') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
