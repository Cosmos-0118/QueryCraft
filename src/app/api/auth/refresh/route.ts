import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { createAccessToken } from '@/lib/auth/tokens';
import { validateRefreshToken, revokeRefreshToken, createRefreshSession } from '@/lib/auth/session';
import { verifyAccessToken } from '@/lib/auth/tokens';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refreshToken')?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token provided' }, { status: 401 });
    }

    // Try to get the userId from the expired access token or request body
    let userId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = await verifyAccessToken(authHeader.slice(7));
        userId = payload.sub;
      } catch {
        // Token might be expired — try request body
      }
    }

    if (!userId) {
      try {
        const body = await request.json();
        userId = body.userId;
      } catch {
        // No body provided
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unable to identify user' }, { status: 401 });
    }

    const session = await validateRefreshToken(refreshToken, userId);
    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
    }

    // Rotate: revoke old, create new
    await revokeRefreshToken(refreshToken);

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const accessToken = await createAccessToken(user.id, user.email);
    const newRefresh = await createRefreshSession(user.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      accessToken,
    });

    response.cookies.set('refreshToken', newRefresh.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
