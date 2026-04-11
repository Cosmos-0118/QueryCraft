import { NextRequest, NextResponse } from 'next/server';
import { saveAttemptAnswers } from '@/lib/test/test-module-db';

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

// PATCH /api/tests/:id/attempts/:attemptId
export async function PATCH(
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const rawAnswers = (body as { answers?: unknown }).answers;
    if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) {
      return NextResponse.json({ error: 'answers must be an object keyed by question id.' }, { status: 400 });
    }

    const answers = Object.entries(rawAnswers as Record<string, unknown>).reduce<Record<string, string>>(
      (acc, [questionId, value]) => {
        if (typeof value === 'string') {
          acc[questionId] = value;
        }
        return acc;
      },
      {},
    );

    const attempt = await saveAttemptAnswers({
      testId,
      attemptId,
      answers,
    });

    return NextResponse.json({ attempt }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save attempt answers.';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
