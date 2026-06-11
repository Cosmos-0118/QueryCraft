import { NextRequest, NextResponse } from 'next/server';
import {
  addQuestionBankQuestionsToTest,
  getTestById,
} from '@/lib/test/test-module-db';
import {
  ensureTeacherOwnsTest,
  requireTestActor,
} from '@/lib/security/test-module-security';

export async function POST(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  try {
    const actorResult = requireTestActor(req, {
      allowedRoles: ['admin', 'teacher'],
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const params = await Promise.resolve(context.params);
    const testId = params.id;
    const ownership = await ensureTeacherOwnsTest(actorResult.value, testId);
    if (!ownership.ok) {
      return ownership.response;
    }

    const test = await getTestById(testId);
    if (!test) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    }
    if (test.status.toLowerCase() === 'published') {
      return NextResponse.json(
        { error: 'Published tests are read-only. Question editing is disabled after publish.' },
        { status: 409 },
      );
    }

    const body = await req.json().catch(() => null);
    const ids = body && typeof body === 'object' && Array.isArray((body as { question_bank_ids?: unknown }).question_bank_ids)
      ? (body as { question_bank_ids: unknown[] }).question_bank_ids
      : null;
    if (!ids) {
      return NextResponse.json(
        { error: 'question_bank_ids must be an array of question bank ids.' },
        { status: 400 },
      );
    }

    const questionBankIds = ids
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);

    const questions = await addQuestionBankQuestionsToTest({
      testId,
      questionBankIds,
    });

    if (questions === null) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    }

    return NextResponse.json({
      questions,
      added: questions.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add selected questions.';
    const isValidationError = message.includes('MCQ') || message.includes('array');
    return NextResponse.json(
      { error: message },
      { status: isValidationError ? 400 : 500 },
    );
  }
}
