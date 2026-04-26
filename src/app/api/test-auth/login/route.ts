import { NextRequest, NextResponse } from 'next/server';
import { findAccountByEmailWithSecret } from '@/lib/test-auth/accounts-db';
import { resolveAdminConfig, deriveDisplayName } from '@/lib/test-auth/admin-env';
import { signTestAuthToken, verifyPassword } from '@/lib/test-auth/crypto';

const GENERIC_ERROR = 'Email or password is incorrect.';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const emailLower = email.toLowerCase();
    const adminConfig = resolveAdminConfig();

    if (adminConfig && adminConfig.emailLower === emailLower) {
      if (password !== adminConfig.password) {
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
      }

      const token = signTestAuthToken({
        sub: adminConfig.pseudoId,
        email: adminConfig.email,
        role: 'admin',
        displayName: adminConfig.displayName,
      });

      return NextResponse.json({
        token,
        user: {
          id: adminConfig.pseudoId,
          email: adminConfig.email,
          role: 'admin',
          display_name: adminConfig.displayName,
          password_set: true,
        },
      });
    }

    const account = await findAccountByEmailWithSecret(email);
    if (!account || !account.is_active) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    if (!account.password_set || !account.password_hash) {
      return NextResponse.json(
        {
          error: 'No password is set for this account yet. Create one to continue.',
          password_set: false,
        },
        { status: 409 },
      );
    }

    const ok = await verifyPassword(password, account.password_hash);
    if (!ok) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const displayName = account.display_name?.trim() || deriveDisplayName(account.email);
    const token = signTestAuthToken({
      sub: account.id,
      email: account.email,
      role: account.role,
      displayName,
    });

    return NextResponse.json({
      token,
      user: {
        id: account.id,
        email: account.email,
        role: account.role,
        display_name: displayName,
        password_set: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to sign in.' },
      { status: 500 },
    );
  }
}
