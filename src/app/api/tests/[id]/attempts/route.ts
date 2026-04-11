import { NextRequest, NextResponse } from 'next/server';
import {
  getAttemptById,
  getLatestAttemptForStudent,
  startOrResumeAttempt,
} from '@/lib/test/test-module-db';

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
    const testId = await resolveTestId(context);
    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    const attemptId = req.nextUrl.searchParams.get('attemptId');
    const studentId = req.nextUrl.searchParams.get('studentId');

    if (attemptId) {
      const attempt = await getAttemptById(testId, attemptId);
      if (!attempt) {
        return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
      }
      return NextResponse.json({ attempt }, { status: 200 });
    }

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required.' }, { status: 400 });
    }

    const attempt = await getLatestAttemptForStudent(testId, studentId);
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
    const testId = await resolveTestId(context);
    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    const body = await req.json();
    if (!body?.student_id || typeof body.student_id !== 'string') {
      return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });
    }
    if (!body?.student_name || typeof body.student_name !== 'string') {
      return NextResponse.json({ error: 'student_name is required.' }, { status: 400 });
    }

    const attempt = await startOrResumeAttempt({
      testId,
      studentId: body.student_id,
      studentName: body.student_name,
    });

    return NextResponse.json({ attempt }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start attempt.';
    const status = message.toLowerCase().includes('code') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
