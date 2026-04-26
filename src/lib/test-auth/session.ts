import type { NextRequest } from 'next/server';
import { verifyTestAuthToken, type TestAuthTokenPayload } from '@/lib/test-auth/crypto';

export const TEST_AUTH_HEADER = 'x-test-auth-token';

export function readTokenFromRequest(req: NextRequest | Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const value = authHeader.slice(7).trim();
    if (value) return value;
  }

  const customHeader = req.headers.get(TEST_AUTH_HEADER);
  if (customHeader && customHeader.trim().length > 0) {
    return customHeader.trim();
  }

  return null;
}

export function readTestAuthSession(req: NextRequest | Request): TestAuthTokenPayload | null {
  const token = readTokenFromRequest(req);
  return verifyTestAuthToken(token);
}

export function requireAdminSession(req: NextRequest | Request): TestAuthTokenPayload | null {
  const session = readTestAuthSession(req);
  if (!session || session.role !== 'admin') return null;
  return session;
}

export function requireTeacherOrAdminSession(req: NextRequest | Request): TestAuthTokenPayload | null {
  const session = readTestAuthSession(req);
  if (!session) return null;
  if (session.role !== 'teacher' && session.role !== 'admin') return null;
  return session;
}
