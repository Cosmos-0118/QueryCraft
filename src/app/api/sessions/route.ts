import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { savedSessions } from '@/lib/db/schema';
import { sanitizeInput } from '@/lib/security/input-sanitizer';
import { eq } from 'drizzle-orm';

const VALID_SESSION_TYPES = ['sandbox', 'lesson', 'algebra', 'normalizer', 'er-builder'];
const MAX_STATE_SIZE = 500_000; // 500KB limit for state JSON

// GET /api/sessions — list all saved sessions for the user
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const rows = await db.select().from(savedSessions).where(eq(savedSessions.userId, auth.userId));

    const filtered = type ? rows.filter((r) => r.sessionType === type) : rows;

    return NextResponse.json({
      sessions: filtered.map((r) => ({
        id: r.id,
        sessionType: r.sessionType,
        sessionName: r.sessionName,
        stateJson: r.stateJson,
        createdAt: r.createdAt?.toISOString() ?? null,
        updatedAt: r.updatedAt?.toISOString() ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/sessions — create a new saved session
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const sessionType =
      typeof body.sessionType === 'string' ? sanitizeInput(body.sessionType, 50) : '';
    const sessionName =
      typeof body.sessionName === 'string'
        ? sanitizeInput(body.sessionName, 200)
        : 'Untitled Session';
    const stateJson = body.stateJson;

    if (!sessionType || !VALID_SESSION_TYPES.includes(sessionType)) {
      return NextResponse.json(
        { error: `sessionType must be one of: ${VALID_SESSION_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    if (!stateJson || typeof stateJson !== 'object') {
      return NextResponse.json({ error: 'stateJson must be a JSON object' }, { status: 400 });
    }

    const stateStr = JSON.stringify(stateJson);
    if (stateStr.length > MAX_STATE_SIZE) {
      return NextResponse.json(
        { error: 'Session state is too large (max 500KB)' },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(savedSessions)
      .values({
        userId: auth.userId,
        sessionType,
        sessionName,
        stateJson,
      })
      .returning({ id: savedSessions.id, createdAt: savedSessions.createdAt });

    return NextResponse.json(
      { message: 'Session created', id: created.id, createdAt: created.createdAt?.toISOString() },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
