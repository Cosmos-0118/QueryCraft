import { NextRequest, NextResponse } from 'next/server';
import {
  listQuestionBankQuestions,
  uploadQuestionsToBank,
  type QuestionBankUploadQuestionInput,
} from '@/lib/test/test-module-db';
import { requireTestActor } from '@/lib/security/test-module-security';

function parseUnitsParam(value: string | null): number[] | undefined {
  if (!value) return undefined;
  const parsed = value
    .split(',')
    .map((item) => Math.floor(Number(item.trim())))
    .filter((item) => Number.isFinite(item) && item >= 1 && item <= 99);
  return parsed.length > 0 ? Array.from(new Set(parsed)) : undefined;
}

// GET /api/tests/questions-bank
export async function GET(req: NextRequest) {
  try {
    const actorResult = requireTestActor(req, {
      allowedRoles: ['admin', 'teacher'],
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const { searchParams } = req.nextUrl;
    const difficultyParam = searchParams.get('difficulty');
    const questionTypeParam = searchParams.get('question_type');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const list = await listQuestionBankQuestions({
      query: searchParams.get('q') ?? undefined,
      units: parseUnitsParam(searchParams.get('units')),
      difficulty:
        difficultyParam === 'easy'
        || difficultyParam === 'medium'
        || difficultyParam === 'hard'
        || difficultyParam === 'mixed'
          ? difficultyParam
          : undefined,
      questionType:
        questionTypeParam === 'mcq'
        || questionTypeParam === 'sql_fill'
        || questionTypeParam === 'mixed'
          ? questionTypeParam
          : undefined,
      uploadedFrom: searchParams.get('uploaded_from') ?? undefined,
      uploadedTo: searchParams.get('uploaded_to') ?? undefined,
      limit: limitParam ? Number.parseInt(limitParam, 10) : undefined,
      offset: offsetParam ? Number.parseInt(offsetParam, 10) : undefined,
    });

    return NextResponse.json(list);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to list question bank.';
    const isValidationError = message.includes('valid date');
    return NextResponse.json(
      { error: message },
      { status: isValidationError ? 400 : 500 },
    );
  }
}

// POST /api/tests/questions-bank
export async function POST(req: NextRequest) {
  try {
    const actorResult = requireTestActor(req, {
      allowedRoles: ['admin', 'teacher'],
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const body = await req.json().catch(() => null);
    const list = Array.isArray(body)
      ? body
      : (body && typeof body === 'object' && Array.isArray((body as { questions?: unknown }).questions))
        ? (body as { questions: unknown[] }).questions
        : null;

    if (!list) {
      return NextResponse.json(
        { error: 'Payload must be an array of questions or an object with a questions array.' },
        { status: 400 },
      );
    }

    const questions: QuestionBankUploadQuestionInput[] = list.map((row) => {
      const input = (row && typeof row === 'object') ? row as Record<string, unknown> : {};
      const options = Array.isArray(input.options)
        ? input.options.map((option) => {
          const item = (option && typeof option === 'object') ? option as Record<string, unknown> : {};
          return {
            key: typeof item.key === 'string' ? item.key : undefined,
            text: typeof item.text === 'string' ? item.text : '',
          };
        })
        : undefined;

      return {
        prompt: typeof input.prompt === 'string' ? input.prompt : '',
        question_type: input.question_type === 'mcq' || input.question_type === 'sql_fill'
          ? input.question_type
          : undefined,
        options,
        correct_answer: typeof input.correct_answer === 'string' ? input.correct_answer : '',
        difficulty: input.difficulty === 'easy' || input.difficulty === 'medium' || input.difficulty === 'hard'
          ? input.difficulty
          : undefined,
        marks: typeof input.marks === 'number' ? input.marks : undefined,
        explanation: typeof input.explanation === 'string' ? input.explanation : undefined,
        unit: typeof input.unit === 'number' ? input.unit : undefined,
      };
    });

    const result = await uploadQuestionsToBank({
      actorUserId: actorResult.value.primaryUserId,
      actorDisplayName: actorResult.value.displayName,
      questions,
    });

    return NextResponse.json({ ok: true, inserted: result.inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to upload questions.';
    const isValidationError =
      message.includes('Question ')
      || message.includes('required')
      || message.includes('at most');
    return NextResponse.json(
      { error: message },
      { status: isValidationError ? 400 : 500 },
    );
  }
}
