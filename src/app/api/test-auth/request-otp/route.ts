import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminAccount, findAccountByEmail } from '@/features/test-module/auth/accounts-db';
import { resolveAdminConfig } from '@/features/test-module/auth/admin-env';
import { createSetupOtp } from '@/features/test-module/auth/otp-db';
import { sendSetupOtpEmail } from '@/features/test-module/auth/email';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { email?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    const adminConfig = resolveAdminConfig();
    const account = adminConfig && adminConfig.emailLower === email.toLowerCase()
      ? await ensureAdminAccount(adminConfig.email)
      : await findAccountByEmail(email);

    if (!account) {
      return NextResponse.json(
        { error: 'This email is not registered. Ask the admin to add the account.' },
        { status: 404 },
      );
    }

    if (!account.is_active) {
      return NextResponse.json({ error: 'This account has been disabled. Contact your administrator.' }, { status: 403 });
    }

    if (account.password_set) {
      return NextResponse.json({ error: 'This account already has a password. Please sign in.' }, { status: 409 });
    }

    if (account.role === 'admin') {
      return NextResponse.json({
        ok: true,
        role: 'admin' as const,
        admin_setup_without_otp: true,
      });
    }

    if (account.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Students sign in with the password set by admin.' },
        { status: 403 },
      );
    }

    const otp = await createSetupOtp(account.email);
    const emailResult = await sendSetupOtpEmail({
      toEmail: account.email,
      otp: otp.otp,
      expiresInMinutes: otp.expiresInMinutes,
    });

    return NextResponse.json({
      ok: true,
      role: account.role,
      email_sent: emailResult.sent,
      expires_in_minutes: otp.expiresInMinutes,
      dev_otp: emailResult.devOtp,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to send OTP.' },
      { status: 500 },
    );
  }
}
