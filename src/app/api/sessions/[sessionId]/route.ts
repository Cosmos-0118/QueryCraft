import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { savedSessions } from '@/lib/db/schema';
import { sanitizeInput } from '@/lib/security/input-sanitizer';
import { eq, and } from 'drizzle-orm';

const MAX_STATE_SIZE = 500_000;

// GET /api/sessions/[sessionId] — get a single session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (isAuthError(auth)) return auth;

    const { sessionId } = await params;
    const [session] = await db
      .select()
      .from(savedSessions)
      .where(and(eq(savedSessions.id, sessionId), eq(savedSessions.userId, auth.userId)))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      sessionType: session.sessionType,
      sessionName: session.sessionName,
      stateJson: session.stateJson,
      createdAt: session.createdAt?.toISOString() ?? null,
      updatedAt: session.updatedAt?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/sessions/[sessionId] — update a session's name or state
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (isAuthError(auth)) return auth;

    const { sessionId } = await params;

    // Verify ownership
    const [session] = await db
      .select()
      .from(savedSessions)
      .where(and(eq(savedSessions.id, sessionId), eq(savedSessions.userId, auth.userId)))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.sessionName === 'string') {
      updates.sessionName = sanitizeInput(body.sessionName, 200);
    }

    if (body.stateJson && typeof body.stateJson === 'object') {
      const stateStr = JSON.stringify(body.stateJson);
      if (stateStr.length > MAX_STATE_SIZE) {
        return NextResponse.json(
          { error: 'Session state is too large (max 500KB)' },
          { status: 400 },
        );
      }
      updates.stateJson = body.stateJson;
    }

    await db.update(savedSessions).set(updates).where(eq(savedSessions.id, sessionId));

    return NextResponse.json({ message: 'Session updated' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/sessions/[sessionId] — delete a session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (isAuthError(auth)) return auth;

    const { sessionId } = await params;

    // Verify ownership before deleting
    const [session] = await db
      .select({ id: savedSessions.id })
      .from(savedSessions)
      .where(and(eq(savedSessions.id, sessionId), eq(savedSessions.userId, auth.userId)))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await db.delete(savedSessions).where(eq(savedSessions.id, sessionId));

    return NextResponse.json({ message: 'Session deleted' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
