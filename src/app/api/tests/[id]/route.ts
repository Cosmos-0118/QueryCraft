import { NextRequest, NextResponse } from 'next/server';
import { getTestById, updateDraftTest } from '@/lib/test/test-module-db';

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
