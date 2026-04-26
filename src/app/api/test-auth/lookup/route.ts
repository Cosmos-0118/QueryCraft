import { NextRequest, NextResponse } from 'next/server';
import { findAccountByEmail } from '@/lib/test-auth/accounts-db';
import { resolveAdminConfig } from '@/lib/test-auth/admin-env';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { email?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    const adminConfig = resolveAdminConfig();
    if (adminConfig && adminConfig.emailLower === email.toLowerCase()) {
      return NextResponse.json({
        exists: true,
        password_set: true,
        is_active: true,
        role: 'admin' as const,
      });
    }

    const account = await findAccountByEmail(email);
    if (!account) {
      return NextResponse.json({
        exists: false,
        password_set: false,
        is_active: false,
        role: null,
      });
    }

    return NextResponse.json({
      exists: true,
      password_set: account.password_set,
      is_active: account.is_active,
      role: account.role,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to look up account.' },
      { status: 500 },
    );
  }
}
