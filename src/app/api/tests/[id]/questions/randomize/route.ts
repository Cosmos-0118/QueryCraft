import { NextRequest, NextResponse } from 'next/server';
import { addRandomQuestionsFromBankToTest } from '@/lib/test/test-module-db';

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

    const body = await req.json().catch(() => ({} as { count?: unknown }));
    const countValue = body?.count;

    if (typeof countValue !== 'number' || !Number.isFinite(countValue) || countValue <= 0) {
      return NextResponse.json({ error: 'count must be a positive number.' }, { status: 400 });
    }

    const questions = await addRandomQuestionsFromBankToTest({
      testId,
      count: countValue,
    });

    if (questions === null) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    }

    return NextResponse.json({
      questions,
      added: questions.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to randomize questions.' },
      { status: 500 },
    );
  }
}
