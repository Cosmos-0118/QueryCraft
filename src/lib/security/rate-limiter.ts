import { db } from '@/lib/db';
import { rateLimitLog } from '@/lib/db/schema';
import { and, eq, gte } from 'drizzle-orm';
import { RATE_LIMITS } from '@/lib/utils/constants';

type RateLimitAction = keyof typeof RATE_LIMITS;

export async function checkRateLimit(
  identifier: string,
  action: RateLimitAction,
): Promise<{ allowed: boolean; remaining: number; retryAfterMs?: number }> {
  const config = RATE_LIMITS[action];
  const windowStart = new Date(Date.now() - config.windowMs);

  const attempts = await db
    .select()
    .from(rateLimitLog)
    .where(
      and(
        eq(rateLimitLog.identifier, identifier),
        eq(rateLimitLog.action, action),
        gte(rateLimitLog.attemptedAt, windowStart),
      ),
    );

  const count = attempts.length;

  if (count >= config.max) {
    const oldest = attempts.reduce(
      (min, a) => (a.attemptedAt && a.attemptedAt < min ? a.attemptedAt : min),
      new Date(),
    );
    const retryAfterMs = config.windowMs - (Date.now() - oldest.getTime());
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  return { allowed: true, remaining: config.max - count };
}

export async function recordRateLimitAttempt(identifier: string, action: string): Promise<void> {
  await db.insert(rateLimitLog).values({ identifier, action });
}
