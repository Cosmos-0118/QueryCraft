import { NextRequest, NextResponse } from 'next/server';
import {
  applyTestAuthCookie,
  readTestAuthSession,
  readTokenFromRequest,
} from '@/features/test-module/auth/session';
import { findAccountById } from '@/features/test-module/auth/accounts-db';
import { isAdminPseudoId } from '@/features/test-module/auth/admin-env';

// GET /api/test-auth/me
// Returns the current authenticated test-module user from signed session token.
export async function GET(req: NextRequest) {
  const session = readTestAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (session.role === 'admin' && isAdminPseudoId(session.sub)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const account = await findAccountById(session.sub);
  if (!account || !account.is_active || account.role !== session.role) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      id: session.sub,
      email: session.email,
      role: session.role,
      display_name: account?.display_name ?? session.displayName,
      faculty_id: account?.faculty_id ?? null,
      registration_number: account?.registration_number ?? null,
      section: account?.section ?? null,
    },
  });

  // Sliding session: refresh cookie lifetime when token is still valid.
  const token = readTokenFromRequest(req);
  if (token) {
    applyTestAuthCookie(response, token);
  }

  return response;
}
