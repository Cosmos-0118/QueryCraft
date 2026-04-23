import { NextRequest, NextResponse } from 'next/server';
import { getTestById, updateDraftTest } from '@/lib/test/test-module-db';
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
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a number.`);
  }

  return Math.round(value);
}

type QuestionMode = 'mcq_only' | 'sql_only' | 'mixed';

function parseOptionalPercent(value: unknown, fieldName: 'mix_mcq_percent' | 'mix_sql_fill_percent') {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a number.`);
  }

  return Math.round(value);
}

function resolveViewer(req: NextRequest): { role?: 'teacher' | 'student'; userId?: string } {
  const roleParam = req.nextUrl.searchParams.get('role');
  const role = roleParam === 'teacher' || roleParam === 'student'
    ? roleParam
    : undefined;
  const userId = req.nextUrl.searchParams.get('userId')?.trim() || undefined;

  return { role, userId };
}

function getParamId(
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  return Promise.resolve(context.params).then((params) => params.id);
}

// GET /api/tests/:id
export async function GET(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  try {
    const id = await getParamId(context);
    if (!id) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    const test = await getTestById(id);
    if (!test) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    }

    const viewer = resolveViewer(req);
    if (viewer.role === 'teacher') {
      if (!viewer.userId) {
        return NextResponse.json({ error: 'userId is required for teacher access.' }, { status: 400 });
      }

      if (test.created_by !== viewer.userId) {
        return NextResponse.json({ error: 'You do not have access to this test.' }, { status: 403 });
      }
    }

    return NextResponse.json({ test }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/tests/:id] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load test.' },
      { status: 500 },
    );
  }
}

// PATCH /api/tests/:id

// Next.js App Router: extract id from URL if params not provided
export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const id = await getParamId(context);
    if (!id) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    const viewer = resolveViewer(req);
    if (viewer.role !== 'teacher' || !viewer.userId) {
      return NextResponse.json({ error: 'Teacher userId is required.' }, { status: 400 });
    }

    const current = await getTestById(id);
    if (!current) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    }

    if (current.created_by !== viewer.userId) {
      return NextResponse.json({ error: 'You do not have permission to modify this test.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const hasUpdatableField =
      body.title !== undefined
      || body.description !== undefined
      || body.status !== undefined
      || body.question_mode !== undefined
      || body.mix_mcq_percent !== undefined
      || body.mix_sql_fill_percent !== undefined
      || body.module_type !== undefined
      || body.interactive_settings !== undefined;

    if (!hasUpdatableField) {
      return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 400 });
    }

    const questionMode = body.question_mode;
    const moduleType = body.module_type;

    if (
      questionMode !== undefined
      && questionMode !== 'mcq_only'
      && questionMode !== 'sql_only'
      && questionMode !== 'mixed'
    ) {
      return NextResponse.json(
        { error: 'question_mode must be one of mcq_only, sql_only, or mixed.' },
        { status: 400 },
      );
    }

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

    const updated = await updateDraftTest(id, {
      title: typeof body.title === 'string' ? body.title : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      status: typeof body.status === 'string'
        ? body.status as 'draft' | 'published' | 'closed' | 'archived'
        : undefined,
      question_mode: questionMode as QuestionMode | undefined,
      mix_mcq_percent: parseOptionalPercent(body.mix_mcq_percent, 'mix_mcq_percent'),
      mix_sql_fill_percent: parseOptionalPercent(body.mix_sql_fill_percent, 'mix_sql_fill_percent'),
      module_type: moduleType as TestModuleType | undefined,
      interactive_settings: interactiveSettings,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Test not found or not updatable.' }, { status: 404 });
    }
    return NextResponse.json({ test: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update test.';
    const isValidationError =
      message.includes('mix_')
      || message.includes('question_mode')
      || message.includes('add up to 100');

    console.error('[PATCH /api/tests/:id] Error:', error);
    return NextResponse.json({ error: message }, { status: isValidationError ? 400 : 500 });
  }
}
