import { NextRequest, NextResponse } from 'next/server';
import {
  getAttemptById,
  getTestById,
  overrideSubmittedAttemptScore,
  submitAttempt,
} from '@/lib/test/test-module-db';
import { calculateInteractiveAttemptScore, normalizeInteractiveQuizSettings } from '@/lib/test/interactive-quiz';

interface SubmitAttemptBody {
  answers?: Record<string, string>;
  mode?: 'classic' | 'interactive_quiz';
  timing_by_question?: Record<string, number>;
}

function parseTimingByQuestion(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const parsed: Record<string, number> = {};
  for (const [questionId, candidate] of Object.entries(value as Record<string, unknown>)) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      parsed[questionId] = candidate;
    }
  }

  return parsed;
}

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

    const body = await req.json().catch(() => ({} as SubmitAttemptBody));

    const attempt = await submitAttempt({
      testId,
      attemptId,
      answers: body.answers,
    });

    if (body.mode === 'interactive_quiz') {
      const test = await getTestById(testId);

      if (test?.module_type === 'interactive_quiz') {
        const settings = normalizeInteractiveQuizSettings(test.interactive_settings);
        const scoring = calculateInteractiveAttemptScore({
          results: attempt.results,
          timing_by_question: parseTimingByQuestion(body.timing_by_question),
          settings,
        });

        await overrideSubmittedAttemptScore({
          attemptId,
          points: scoring.total_points,
        });

        const updatedAttempt = await getAttemptById(testId, attemptId);

        return NextResponse.json(
          {
            attempt: updatedAttempt ?? attempt,
            interactive: {
              total_points: scoring.total_points,
              breakdown: scoring.breakdown,
              settings,
            },
          },
          { status: 200 },
        );
      }
    }

    return NextResponse.json({ attempt }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to submit attempt.' },
      { status: 400 },
    );
  }
}
