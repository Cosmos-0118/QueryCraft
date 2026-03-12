import { db } from '@/lib/db';
import { refreshTokens } from '@/lib/db/schema';
import { generateRefreshToken } from './tokens';
import { createHash } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { TOKEN_EXPIRY } from '@/lib/utils/constants';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createRefreshSession(userId: string) {
  const token = generateRefreshToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.REFRESH * 1000);

  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });

  return { token, expiresAt };
}

export async function validateRefreshToken(token: string, userId: string) {
  const tokenHash = hashToken(token);

  const [session] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.revoked, false),
      ),
    )
    .limit(1);

  if (!session) return null;
  if (new Date() > session.expiresAt) return null;

  return session;
}

export async function revokeRefreshToken(token: string) {
  const tokenHash = hashToken(token);
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function revokeAllUserSessions(userId: string) {
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.userId, userId));
}
