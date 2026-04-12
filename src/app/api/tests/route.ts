import { NextRequest, NextResponse } from 'next/server';
import { createDraftTest, listTests, type TestRole } from '@/lib/test/test-module-db';

type QuestionMode = 'mcq_only' | 'sql_only' | 'mixed';

function parseOptionalPercent(value: unknown, fieldName: 'mix_mcq_percent' | 'mix_sql_fill_percent') {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a number.`);
  }

  return Math.round(value);
}

// GET /api/tests
export async function GET(req: NextRequest) {
  try {
    const roleParam = req.nextUrl.searchParams.get('role');
    const role = roleParam === 'teacher' || roleParam === 'student'
      ? roleParam
      : undefined;
    const userId = req.nextUrl.searchParams.get('userId') ?? undefined;

    if (role === 'teacher' && (!userId || !userId.trim())) {
      return NextResponse.json({ error: 'userId is required for teacher test listing.' }, { status: 400 });
    }

    const tests = await listTests({ role: role as TestRole | undefined, userId });
    return NextResponse.json({ tests });
  } catch (error) {
    console.error('[GET /api/tests] Error:', error);
    return NextResponse.json({ error: 'Failed to load tests', tests: [] }, { status: 500 });
  }
}

// POST /api/tests
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'Missing required field: title' }, { status: 400 });
    }
    if (!body?.created_by || typeof body.created_by !== 'string') {
      return NextResponse.json({ error: 'Missing required field: created_by' }, { status: 400 });
    }

    const questionMode = body.question_mode ?? 'mcq_only';
    if (questionMode !== 'mcq_only' && questionMode !== 'sql_only' && questionMode !== 'mixed') {
      return NextResponse.json(
        { error: 'question_mode must be one of mcq_only, sql_only, or mixed.' },
        { status: 400 },
      );
    }

    const mixMcqPercent = parseOptionalPercent(body.mix_mcq_percent, 'mix_mcq_percent');
    const mixSqlFillPercent = parseOptionalPercent(body.mix_sql_fill_percent, 'mix_sql_fill_percent');

    const test = await createDraftTest({
      title: body.title,
      description: body.description ?? '',
      created_by: body.created_by,
      question_mode: questionMode as QuestionMode,
      mix_mcq_percent: mixMcqPercent,
      mix_sql_fill_percent: mixSqlFillPercent,
      duration_minutes: body.duration_minutes,
    });

    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create test.';
    const isValidationError =
      message.includes('mix_')
      || message.includes('question_mode')
      || message.includes('add up to 100');

    console.error('[POST /api/tests] Error:', error);
    return NextResponse.json({ error: message }, { status: isValidationError ? 400 : 500 });
  }
}
