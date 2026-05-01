import { NextRequest, NextResponse } from 'next/server';
import {
  applyTestAuthCookie,
  readTestAuthSession,
  readTokenFromRequest,
} from '@/lib/test-auth/session';

// POST /api/test-auth/session
// Sync an already-issued token (typically from local storage) into an httpOnly cookie.
export async function POST(req: NextRequest) {
  const session = readTestAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const token = readTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: 'Missing auth token.' }, { status: 400 });
  }

  const response = NextResponse.json({
    ok: true,
    user: {
      email: session.email,
      role: session.role,
    },
  });

  applyTestAuthCookie(response, token);
  return response;
}
