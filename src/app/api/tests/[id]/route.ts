import { NextRequest, NextResponse } from 'next/server';
import { getTestById, updateDraftTest } from '@/lib/test/test-module-db';

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

    const body = await req.json();
    // Validate input (at least one updatable field)
    if (!body || (!body.title && !body.description && !body.status)) {
      return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 400 });
    }
    const updated = await updateDraftTest(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Test not found or not updatable.' }, { status: 404 });
    }
    return NextResponse.json({ test: updated }, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/tests/:id] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update test.' }, { status: 500 });
  }
}
