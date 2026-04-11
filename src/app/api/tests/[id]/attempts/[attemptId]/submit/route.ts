import { NextRequest, NextResponse } from 'next/server';
import { submitAttempt } from '@/lib/test/test-module-db';

async function resolveParams(
  context:
    | { params: { id: string; attemptId: string } }
    | { params: Promise<{ id: string; attemptId: string }> },
) {
  const params = await Promise.resolve(context.params);
  return {
    testId: params.id,
    attemptId: params.attemptId,
  };
}

// POST /api/tests/:id/attempts/:attemptId/submit
export async function POST(
  req: NextRequest,
  context:
    | { params: { id: string; attemptId: string } }
    | { params: Promise<{ id: string; attemptId: string }> },
) {
  try {
    const { testId, attemptId } = await resolveParams(context);
    if (!testId || !attemptId) {
      return NextResponse.json({ error: 'Test ID and attempt ID are required.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({} as { answers?: Record<string, string> }));

    const attempt = await submitAttempt({
      testId,
      attemptId,
      answers: body.answers,
    });

    return NextResponse.json({ attempt }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to submit attempt.' },
      { status: 400 },
    );
  }
}
