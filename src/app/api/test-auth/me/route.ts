import { NextRequest, NextResponse } from 'next/server';
import {
  applyTestAuthCookie,
  readTestAuthSession,
  readTokenFromRequest,
} from '@/lib/test-auth/session';

// GET /api/test-auth/me
// Returns the current authenticated test-module user from signed session token.
export async function GET(req: NextRequest) {
  const session = readTestAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      id: session.sub,
      email: session.email,
      role: session.role,
      display_name: session.displayName,
    },
  });

  // Sliding session: refresh cookie lifetime when token is still valid.
  const token = readTokenFromRequest(req);
  if (token) {
    applyTestAuthCookie(response, token);
  }

  return response;
}
