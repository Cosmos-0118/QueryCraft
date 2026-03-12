import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { verifyPassword } from '@/lib/auth/crypto';
import { createAccessToken } from '@/lib/auth/tokens';
import { createRefreshSession } from '@/lib/auth/session';
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/security/rate-limiter';
import { loginSchema } from '@/lib/utils/validators';
import { eq } from 'drizzle-orm';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateCheck = await checkRateLimit(ip, 'LOGIN');
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      await recordRateLimitAttempt(ip, 'LOGIN');
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Check account lockout
    if (user.isLocked && user.lockedUntil && new Date() < user.lockedUntil) {
      return NextResponse.json(
        { error: 'Account is temporarily locked. Please try again later.' },
        { status: 423 },
      );
    }

    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
      const newAttempts = (user.failedAttempts ?? 0) + 1;
      const shouldLock = newAttempts >= LOCKOUT_THRESHOLD;

      await db
        .update(users)
        .set({
          failedAttempts: newAttempts,
          isLocked: shouldLock,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        })
        .where(eq(users.id, user.id));

      await recordRateLimitAttempt(ip, 'LOGIN');
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Reset failed attempts on successful login
    if (user.failedAttempts && user.failedAttempts > 0) {
      await db
        .update(users)
        .set({ failedAttempts: 0, isLocked: false, lockedUntil: null })
        .where(eq(users.id, user.id));
    }

    const accessToken = await createAccessToken(user.id, user.email);
    const refreshSession = await createRefreshSession(user.id);
    await recordRateLimitAttempt(ip, 'LOGIN');

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      accessToken,
    });

    response.cookies.set('refreshToken', refreshSession.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
