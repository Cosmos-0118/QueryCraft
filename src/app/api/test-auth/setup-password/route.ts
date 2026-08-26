import { NextRequest, NextResponse } from 'next/server';
import { findAccountByEmailWithSecret, setInitialPasswordForEmail } from '@/features/test-module/auth/accounts-db';
import { signTestAuthToken } from '@/features/test-module/auth/crypto';
import { deriveDisplayName } from '@/features/test-module/auth/admin-env';
import { applyTestAuthCookie } from '@/features/test-module/auth/session';
import { verifyAndConsumeSetupOtp } from '@/features/test-module/auth/otp-db';

const MIN_PASSWORD_LENGTH = 6;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as {
      email?: unknown;
      otp?: unknown;
      password?: unknown;
      confirm_password?: unknown;
      faculty_id?: unknown;
      registration_number?: unknown;
      section?: unknown;
    } | null;

    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const otp = typeof body?.otp === 'string' ? body.otp.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const confirmPassword = typeof body?.confirm_password === 'string' ? body.confirm_password : '';
    const facultyId = typeof body?.faculty_id === 'string' ? body.faculty_id.trim() : '';
    const registrationNumber = typeof body?.registration_number === 'string' ? body.registration_number.trim() : '';
    const section = typeof body?.section === 'string' ? body.section.trim() : '';

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

    if (existing.role === 'teacher' && !facultyId) {
      return NextResponse.json({ error: 'Faculty ID is required.' }, { status: 400 });
    }

    if (existing.role === 'student' && (!registrationNumber || !section)) {
      return NextResponse.json({ error: 'Registration number and section are required.' }, { status: 400 });
    }

    if (existing.role === 'teacher') {
      if (!otp) {
        return NextResponse.json({ error: 'OTP is required.' }, { status: 400 });
      }

      const otpOk = await verifyAndConsumeSetupOtp(email, otp);
      if (!otpOk) {
        return NextResponse.json({ error: 'The OTP is invalid or expired.' }, { status: 400 });
      }
    }

    const updated = await setInitialPasswordForEmail(email, password, {
      facultyId: existing.role === 'teacher' ? facultyId : null,
      registrationNumber: existing.role === 'student' ? registrationNumber : null,
      section: existing.role === 'student' ? section : null,
    });
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

    const response = NextResponse.json({
      token,
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        display_name: displayName,
        faculty_id: updated.faculty_id,
        registration_number: updated.registration_number,
        section: updated.section,
        password_set: true,
      },
    });

    applyTestAuthCookie(response, token);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to set password.' },
      { status: 500 },
    );
  }
}
