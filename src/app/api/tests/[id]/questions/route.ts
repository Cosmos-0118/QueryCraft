import { NextResponse } from 'next/server';
import {
  addQuestionToTest,
  getTestOwnerAppUserId,
  getTestById,
  listQuestionsForTest,
  removeQuestionFromTest,
  updateQuestionAnswer,
} from '@/lib/test/test-module-db';

function normalizeOptionKey(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
}

async function ensureTeacherAccess(req: Request, testId: string) {
  const searchParams = new URL(req.url).searchParams;
  const role = searchParams.get('role');
  const userId = searchParams.get('userId')?.trim();

  if (role !== 'teacher' || !userId) {
    return { error: NextResponse.json({ error: 'Teacher userId is required.' }, { status: 400 }) };
  }

  const ownerUserId = await getTestOwnerAppUserId(testId);
  if (!ownerUserId) {
    return { error: NextResponse.json({ error: 'Test not found.' }, { status: 404 }) };
  }

  if (ownerUserId !== userId) {
    return { error: NextResponse.json({ error: 'You do not have access to this test.' }, { status: 403 }) };
  }

  return { error: null };
}

async function ensureEditableTest(testId: string) {
  const test = await getTestById(testId);
  if (!test) {
    return { error: NextResponse.json({ error: 'Test not found.' }, { status: 404 }) };
  }

  if (test.status.toLowerCase() === 'published') {
    return {
      error: NextResponse.json(
        { error: 'Published tests are read-only. Question editing is disabled after publish.' },
        { status: 409 },
      ),
    };
  }

  return { error: null };
}

export async function GET(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const searchParams = new URL(req.url).searchParams;
  const includeAnswer = searchParams.get('view') === 'teacher';

  if (searchParams.get('role') === 'teacher') {
    const access = await ensureTeacherAccess(req, params.id);
    if (access.error) return access.error;
  }

  const questions = (await listQuestionsForTest(params.id)).map((question) => (
    includeAnswer
      ? question
      : {
        ...question,
        correct_answer: null,
      }
  ));
  return NextResponse.json({ questions });
}


export async function POST(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const access = await ensureTeacherAccess(req, params.id);
  if (access.error) return access.error;

  const editability = await ensureEditableTest(params.id);
  if (editability.error) return editability.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body?.text || typeof body.text !== 'string') {
    return NextResponse.json({ error: 'Question text is required.' }, { status: 400 });
  }

  const requestedType = body?.question_type;
  if (requestedType !== undefined && requestedType !== 'mcq' && requestedType !== 'sql_fill') {
    return NextResponse.json({ error: 'question_type must be either mcq or sql_fill.' }, { status: 400 });
  }

  if (body?.correct_answer !== undefined && typeof body.correct_answer !== 'string') {
    return NextResponse.json({ error: 'Question answer must be a string.' }, { status: 400 });
  }

  if (body?.options !== undefined) {
    if (!Array.isArray(body.options)) {
      return NextResponse.json({ error: 'options must be an array.' }, { status: 400 });
    }

    const options = body.options as unknown[];
    const invalidOption = options.some((option: unknown) => {
      if (!option || typeof option !== 'object') return true;
      const text = (option as { text?: unknown }).text;
      const key = (option as { key?: unknown }).key;
      return typeof text !== 'string' || (key !== undefined && typeof key !== 'string');
    });

    if (invalidOption) {
      return NextResponse.json({ error: 'Each option must include text and optional key as strings.' }, { status: 400 });
    }
  }

  const inferredType = requestedType
    ?? (Array.isArray(body.options) && body.options.length > 0 ? 'mcq' : 'sql_fill');

  if (inferredType === 'mcq') {
    const candidateOptions: Array<{ key: string; text: string } | null> = (Array.isArray(body.options) ? body.options : [])
      .map((option: unknown, index: number) => {
        if (!option || typeof option !== 'object') {
          return null;
        }

        const parsed = option as { key?: unknown; text?: unknown };
        if (typeof parsed.text !== 'string') {
          return null;
        }

        return {
          key: normalizeOptionKey(typeof parsed.key === 'string' ? parsed.key : String.fromCharCode(65 + index)),
          text: parsed.text.trim(),
        };
      });

    const normalizedOptions = candidateOptions.filter(
      (option: { key: string; text: string } | null): option is { key: string; text: string } => (
        !!option && !!option.key && !!option.text
      ),
    );

    if (normalizedOptions.length < 2) {
      return NextResponse.json({ error: 'MCQ questions require at least 2 options.' }, { status: 400 });
    }

    const answerKey = normalizeOptionKey(typeof body.correct_answer === 'string' ? body.correct_answer : '');
    if (!answerKey) {
      return NextResponse.json({ error: 'MCQ answer key is required.' }, { status: 400 });
    }

    if (!normalizedOptions.some((option) => option.key === answerKey)) {
      return NextResponse.json({ error: 'MCQ answer key must match one option key.' }, { status: 400 });
    }
  }

  let question: Awaited<ReturnType<typeof addQuestionToTest>> = null;
  try {
    question = await addQuestionToTest(params.id, {
      text: body.text.trim(),
      question_type: inferredType,
      correct_answer: typeof body.correct_answer === 'string' ? body.correct_answer : undefined,
      options: Array.isArray(body.options)
        ? body.options.flatMap((option: unknown) => {
          if (!option || typeof option !== 'object') {
            return [];
          }

          const parsed = option as { key?: unknown; text?: unknown };
          if (typeof parsed.text !== 'string') {
            return [];
          }

          return [{
            key: typeof parsed.key === 'string' ? parsed.key : undefined,
            text: parsed.text,
          }];
        })
        : undefined,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to add question.' }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
  }

  return NextResponse.json({ question });
}

export async function PATCH(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const access = await ensureTeacherAccess(req, params.id);
  if (access.error) return access.error;

  const editability = await ensureEditableTest(params.id);
  if (editability.error) return editability.error;

  const body = await req.json();

  if (!body?.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Question id is required.' }, { status: 400 });
  }
  if (body?.correct_answer === undefined || typeof body.correct_answer !== 'string') {
    return NextResponse.json({ error: 'Question answer is required.' }, { status: 400 });
  }

  let question: Awaited<ReturnType<typeof updateQuestionAnswer>> = null;
  try {
    question = await updateQuestionAnswer(params.id, body.id, body.correct_answer);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update question answer.' }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
  }

  return NextResponse.json({ question });
}


export async function DELETE(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const access = await ensureTeacherAccess(req, params.id);
  if (access.error) return access.error;

  const editability = await ensureEditableTest(params.id);
  if (editability.error) return editability.error;

  const body = await req.json();

  if (!body?.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Question id is required.' }, { status: 400 });
  }

  const removed = await removeQuestionFromTest(params.id, body.id);
  if (!removed) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
