import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { requireAuth, isAuthError } from '@/lib/auth/guards';
import { hashPassword, verifyPassword } from '@/lib/auth/crypto';
import { updateProfileSchema } from '@/lib/utils/validators';
import { sanitizeInput } from '@/lib/security/input-sanitizer';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { displayName, currentPassword, newPassword } = parsed.data;
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (displayName) {
    updates.displayName = sanitizeInput(displayName, 100);
  }

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: 'Current password is required to set a new password' },
        { status: 400 },
      );
    }

    const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isValid = await verifyPassword(user.passwordHash, currentPassword);
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
    }

    updates.passwordHash = await hashPassword(newPassword);
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, auth.userId)).returning({
    id: users.id,
    email: users.email,
    displayName: users.displayName,
    createdAt: users.createdAt,
  });

  return NextResponse.json({ user: updated });
}
