import { NextRequest, NextResponse } from 'next/server';
import { createDraftTest, listTests, type TestRole } from '@/lib/test/test-module-db';
import type { InteractiveQuizSettings, TestModuleType } from '@/lib/test/interactive-quiz';

type QuestionMode = 'mcq_only' | 'sql_only' | 'mixed';

function parseInteractiveSettings(value: unknown): Partial<InteractiveQuizSettings> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('interactive_settings must be an object.');
  }

  const source = value as Record<string, unknown>;
  const parsed: Partial<InteractiveQuizSettings> = {};

  if (source.question_timer_seconds !== undefined) {
    if (typeof source.question_timer_seconds !== 'number' || !Number.isFinite(source.question_timer_seconds)) {
      throw new Error('interactive_settings.question_timer_seconds must be a number.');
    }
    parsed.question_timer_seconds = Math.round(source.question_timer_seconds);
  }

  if (source.max_points_per_question !== undefined) {
    if (typeof source.max_points_per_question !== 'number' || !Number.isFinite(source.max_points_per_question)) {
      throw new Error('interactive_settings.max_points_per_question must be a number.');
    }
    parsed.max_points_per_question = Math.round(source.max_points_per_question);
  }

  if (source.randomize_questions !== undefined) {
    if (typeof source.randomize_questions !== 'boolean') {
      throw new Error('interactive_settings.randomize_questions must be a boolean.');
    }
    parsed.randomize_questions = source.randomize_questions;
  }

  if (source.randomize_options !== undefined) {
    if (typeof source.randomize_options !== 'boolean') {
      throw new Error('interactive_settings.randomize_options must be a boolean.');
    }
    parsed.randomize_options = source.randomize_options;
  }

  if (source.difficulty_profile !== undefined) {
    if (
      source.difficulty_profile !== 'basic'
      && source.difficulty_profile !== 'medium'
      && source.difficulty_profile !== 'hard'
      && source.difficulty_profile !== 'mixed'
    ) {
      throw new Error('interactive_settings.difficulty_profile must be one of basic, medium, hard, or mixed.');
    }

    parsed.difficulty_profile = source.difficulty_profile;
  }

  return parsed;
}

function parseOptionalPercent(value: unknown, fieldName: 'mix_mcq_percent' | 'mix_sql_fill_percent') {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a number.`);
  }

  return Math.round(value);
}

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
    const moduleType = body.module_type;

    if (
      moduleType !== undefined
      && moduleType !== 'classic'
      && moduleType !== 'interactive_quiz'
    ) {
      return NextResponse.json(
        { error: 'module_type must be one of classic or interactive_quiz.' },
        { status: 400 },
      );
    }

    const interactiveSettings = parseInteractiveSettings(body.interactive_settings);

    const test = await createDraftTest({
      title: body.title,
      description: body.description ?? '',
      created_by: body.created_by,
      question_mode: questionMode as QuestionMode,
      mix_mcq_percent: mixMcqPercent,
      mix_sql_fill_percent: mixSqlFillPercent,
      duration_minutes: body.duration_minutes,
      module_type: moduleType as TestModuleType | undefined,
      interactive_settings: interactiveSettings,
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
