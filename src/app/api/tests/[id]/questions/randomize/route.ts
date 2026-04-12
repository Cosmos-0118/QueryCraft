import { NextRequest, NextResponse } from 'next/server';
import { addRandomQuestionsFromBankToTest, getTestById } from '@/lib/test/test-module-db';

type RandomQuestionType = 'mcq' | 'sql_fill' | 'mixed';

async function resolveTestId(
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  const params = await Promise.resolve(context.params);
  return params.id;
}

// POST /api/tests/:id/questions/randomize
export async function POST(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  try {
    const testId = await resolveTestId(context);
    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    const role = req.nextUrl.searchParams.get('role');
    const userId = req.nextUrl.searchParams.get('userId')?.trim();
    if (role !== 'teacher' || !userId) {
      return NextResponse.json({ error: 'Teacher userId is required.' }, { status: 400 });
    }

    const test = await getTestById(testId);
    if (!test) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    }

    if (test.created_by !== userId) {
      return NextResponse.json({ error: 'You do not have access to this test.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({} as {
      count?: unknown;
      question_type?: unknown;
      mix_mcq_percent?: unknown;
      mix_mcq_count?: unknown;
    }));
    const countValue = body?.count;
    const requestedType = body?.question_type;
    const requestedMixMcqPercent = body?.mix_mcq_percent;
    const requestedMixMcqCount = body?.mix_mcq_count;

    if (typeof countValue !== 'number' || !Number.isFinite(countValue) || countValue <= 0) {
      return NextResponse.json({ error: 'count must be a positive number.' }, { status: 400 });
    }

    if (
      requestedType !== undefined
      && requestedType !== 'mcq'
      && requestedType !== 'sql_fill'
      && requestedType !== 'mixed'
    ) {
      return NextResponse.json(
        { error: 'question_type must be one of mcq, sql_fill, or mixed.' },
        { status: 400 },
      );
    }

    const questionType = requestedType as RandomQuestionType | undefined;

    if (requestedMixMcqCount !== undefined && requestedMixMcqCount !== null) {
      if (typeof requestedMixMcqCount !== 'number' || !Number.isFinite(requestedMixMcqCount)) {
        return NextResponse.json({ error: 'mix_mcq_count must be a number.' }, { status: 400 });
      }

      if (questionType === 'mcq' || questionType === 'sql_fill') {
        return NextResponse.json(
          { error: 'mix_mcq_count can only be used with mixed question_type.' },
          { status: 400 },
        );
      }
    }

    if (requestedMixMcqPercent !== undefined && requestedMixMcqPercent !== null) {
      if (typeof requestedMixMcqPercent !== 'number' || !Number.isFinite(requestedMixMcqPercent)) {
        return NextResponse.json({ error: 'mix_mcq_percent must be a number.' }, { status: 400 });
      }

      if (questionType === 'mcq' || questionType === 'sql_fill') {
        return NextResponse.json(
          { error: 'mix_mcq_percent can only be used with mixed question_type.' },
          { status: 400 },
        );
      }
    }

    const questions = await addRandomQuestionsFromBankToTest({
      testId,
      count: countValue,
      questionType,
      mixMcqPercent: typeof requestedMixMcqPercent === 'number'
        ? Math.round(requestedMixMcqPercent)
        : undefined,
      mixMcqCount: typeof requestedMixMcqCount === 'number'
        ? Math.round(requestedMixMcqCount)
        : undefined,
    });

    if (questions === null) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    }

    return NextResponse.json({
      questions,
      added: questions.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to randomize questions.';
    const isValidationError =
      message.includes('allows only')
      || message.includes('questionType must be one of')
      || message.includes('Mixed questions require')
      || message.includes('Not enough approved questions for a')
      || message.includes('mix_')
      || message.includes('mixMcqCount')
      || message.includes('add up to 100');

    return NextResponse.json(
      { error: message },
      { status: isValidationError ? 400 : 500 },
    );
  }
}
