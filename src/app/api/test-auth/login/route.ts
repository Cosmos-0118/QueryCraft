import { NextRequest, NextResponse } from 'next/server';
import { findAccountByEmailWithSecret } from '@/features/test-module/auth/accounts-db';
import { deriveDisplayName } from '@/features/test-module/auth/admin-env';
import { signTestAuthToken, verifyPassword } from '@/features/test-module/auth/crypto';
import { applyTestAuthCookie } from '@/features/test-module/auth/session';

const GENERIC_ERROR = 'Email or password is incorrect.';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
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

    const response = NextResponse.json({
      token,
      user: {
        id: account.id,
        email: account.email,
        role: account.role,
        display_name: displayName,
        faculty_id: account.faculty_id,
        registration_number: account.registration_number,
        section: account.section,
        password_set: true,
      },
    });

    applyTestAuthCookie(response, token);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to sign in.' },
      { status: 500 },
    );
  }
}
