import { NextRequest, NextResponse } from 'next/server';
import { getAttemptById, getTestById, listQuestionsForTest } from '@/lib/test/test-module-db';
import {
  calculateInteractiveQuestionPoints,
  normalizeInteractiveQuizSettings,
} from '@/lib/test/interactive-quiz';

interface CheckAnswerBody {
  attempt_id?: string;
  question_id?: string;
  selected_option?: string;
  elapsed_seconds?: number;
}

function normalizeOptionKey(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
}

async function resolveTestId(
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  const params = await Promise.resolve(context.params);
  return params.id;
}

// POST /api/tests/:id/interactive/check
export async function POST(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  try {
    const testId = await resolveTestId(context);
    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({} as CheckAnswerBody));
    if (!body.attempt_id || typeof body.attempt_id !== 'string') {
      return NextResponse.json({ error: 'attempt_id is required.' }, { status: 400 });
    }

    if (!body.question_id || typeof body.question_id !== 'string') {
      return NextResponse.json({ error: 'question_id is required.' }, { status: 400 });
    }

    if (!body.selected_option || typeof body.selected_option !== 'string') {
      return NextResponse.json({ error: 'selected_option is required.' }, { status: 400 });
    }

    const test = await getTestById(testId);
    if (!test) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    }

    if (test.module_type !== 'interactive_quiz') {
      return NextResponse.json({ error: 'This endpoint is only available for interactive quiz tests.' }, { status: 400 });
    }

    const attempt = await getAttemptById(testId, body.attempt_id);
    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
    }

    if (attempt.status !== 'in_progress') {
      return NextResponse.json({ error: 'Attempt is already submitted.' }, { status: 409 });
    }

    const questions = await listQuestionsForTest(testId);
    const question = questions.find((candidate) => candidate.id === body.question_id);
    if (!question) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }

    if (question.question_type !== 'mcq') {
      return NextResponse.json({ error: 'Interactive quiz supports MCQ questions only.' }, { status: 400 });
    }

    const selectedOption = normalizeOptionKey(body.selected_option);
    if (!selectedOption) {
      return NextResponse.json({ error: 'selected_option must be a valid option key.' }, { status: 400 });
    }

    const correctOption = normalizeOptionKey(question.correct_answer ?? '');
    const isCorrect = !!correctOption && selectedOption === correctOption;

    const settings = normalizeInteractiveQuizSettings(test.interactive_settings);
    const elapsedSeconds = typeof body.elapsed_seconds === 'number' && Number.isFinite(body.elapsed_seconds)
      ? body.elapsed_seconds
      : settings.question_timer_seconds;

    const points = calculateInteractiveQuestionPoints({
      isCorrect,
      elapsedSeconds,
      settings,
    });

    return NextResponse.json(
      {
        is_correct: isCorrect,
        points,
        correct_option: correctOption || null,
        selected_option: selectedOption,
        max_points: settings.max_points_per_question,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to evaluate answer.' },
      { status: 400 },
    );
  }
}
