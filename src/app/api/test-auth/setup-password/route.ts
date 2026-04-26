import { NextRequest, NextResponse } from 'next/server';
import { findAccountByEmailWithSecret, setInitialPasswordForEmail } from '@/lib/test-auth/accounts-db';
import { signTestAuthToken } from '@/lib/test-auth/crypto';
import { deriveDisplayName, resolveAdminConfig } from '@/lib/test-auth/admin-env';

const MIN_PASSWORD_LENGTH = 6;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as {
      email?: unknown;
      password?: unknown;
      confirm_password?: unknown;
    } | null;

    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const confirmPassword = typeof body?.confirm_password === 'string' ? body.confirm_password : '';

    if (!email || !password || !confirmPassword) {
      return NextResponse.json({ error: 'Email, password, and confirmation are required.' }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 });
    }

    const adminConfig = resolveAdminConfig();
    if (adminConfig && adminConfig.emailLower === email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Admin password is managed via environment variables.' },
        { status: 403 },
      );
    }

    const existing = await findAccountByEmailWithSecret(email);
    if (!existing || !existing.is_active) {
      // Don't disclose whether the email exists.
      return NextResponse.json(
        { error: 'This email is not authorized to access the test module.' },
        { status: 404 },
      );
    }

    if (existing.password_set) {
      return NextResponse.json(
        { error: 'A password is already set for this account. Please log in instead.' },
        { status: 409 },
      );
    }

    const updated = await setInitialPasswordForEmail(email, password);
    if (!updated) {
      return NextResponse.json({ error: 'Unable to set password.' }, { status: 500 });
    }

    const displayName = updated.display_name?.trim() || deriveDisplayName(updated.email);
    const token = signTestAuthToken({
      sub: updated.id,
      email: updated.email,
      role: updated.role,
      displayName,
    });

    return NextResponse.json({
      token,
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        display_name: displayName,
        password_set: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to set password.' },
      { status: 500 },
    );
  }
}
