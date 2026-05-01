import type { NextRequest, NextResponse } from 'next/server';
import { verifyTestAuthToken, type TestAuthTokenPayload } from '@/lib/test-auth/crypto';

export const TEST_AUTH_HEADER = 'x-test-auth-token';
export const TEST_AUTH_COOKIE = 'qc_test_auth';
export const TEST_AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;

  const target = `${name}=`;
  const parts = cookieHeader.split(';');

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part.startsWith(target)) continue;

    const value = part.slice(target.length);
    if (!value) return null;

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

function readCookieToken(req: NextRequest | Request): string | null {
  const cookieHeader = req.headers.get('cookie');
  const token = readCookieValue(cookieHeader, TEST_AUTH_COOKIE);
  return token && token.trim().length > 0 ? token.trim() : null;
}

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

  const cookieToken = readCookieToken(req);
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

export function applyTestAuthCookie(res: NextResponse, token: string): void {
  res.cookies.set(TEST_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TEST_AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearTestAuthCookie(res: NextResponse): void {
  res.cookies.set(TEST_AUTH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
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
