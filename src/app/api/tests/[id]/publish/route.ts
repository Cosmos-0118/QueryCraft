import { NextRequest, NextResponse } from 'next/server';
import { publishTest } from '@/lib/test/test-module-db';
import { ensureTeacherOwnsTest, requireTestActor } from '@/lib/security/test-module-security';

// POST /api/tests/:id/publish
export async function POST(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const actorResult = requireTestActor(req, {
      allowedRoles: ['admin', 'teacher'],
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }

    // Support both Promise and plain object for context.params
    const params = 'then' in context.params ? await context.params : context.params;
    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    const ownership = await ensureTeacherOwnsTest(actorResult.value, id);
    if (!ownership.ok) {
      return ownership.response;
    }

    const published = await publishTest(id);
    if (!published) {
      return NextResponse.json({ error: 'Test not found or not publishable.' }, { status: 404 });
    }
    return NextResponse.json({ test: published }, { status: 200 });
  } catch (error) {
    console.error('[POST /api/tests/:id/publish] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to publish test.' }, { status: 500 });
  }
}
