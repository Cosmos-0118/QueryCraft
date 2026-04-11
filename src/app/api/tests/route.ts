import { NextRequest, NextResponse } from 'next/server';
import { createDraftTest, listTests, type TestRole } from '@/lib/test/test-module-db';

// GET /api/tests
export async function GET(req: NextRequest) {
  try {
    const roleParam = req.nextUrl.searchParams.get('role');
    const role = roleParam === 'teacher' || roleParam === 'student'
      ? roleParam
      : undefined;
    const userId = req.nextUrl.searchParams.get('userId') ?? undefined;

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

    const test = await createDraftTest({
      title: body.title,
      description: body.description ?? '',
      created_by: body.created_by,
      question_mode: body.question_mode ?? 'mcq_only',
      duration_minutes: body.duration_minutes,
    });

    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/tests] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create test.' }, { status: 500 });
  }
}
