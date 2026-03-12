import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/crypto';
import { createAccessToken } from '@/lib/auth/tokens';
import { createRefreshSession } from '@/lib/auth/session';
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/security/rate-limiter';
import { sanitizeInput } from '@/lib/security/input-sanitizer';
import { registerSchema } from '@/lib/utils/validators';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateCheck = await checkRateLimit(ip, 'REGISTER');
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { email, password, displayName } = parsed.data;
    const sanitizedName = sanitizeInput(displayName, 100);

    // Check if user already exists
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      await recordRateLimitAttempt(ip, 'REGISTER');
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({ email, passwordHash, displayName: sanitizedName })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        createdAt: users.createdAt,
      });

    const accessToken = await createAccessToken(newUser.id, newUser.email);
    const refreshSession = await createRefreshSession(newUser.id);
    await recordRateLimitAttempt(ip, 'REGISTER');

    const response = NextResponse.json(
      {
        user: {
          id: newUser.id,
          email: newUser.email,
          displayName: newUser.displayName,
          createdAt: newUser.createdAt,
        },
        accessToken,
      },
      { status: 201 },
    );

    response.cookies.set('refreshToken', refreshSession.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
