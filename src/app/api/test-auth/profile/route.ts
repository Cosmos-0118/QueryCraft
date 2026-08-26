import { NextRequest, NextResponse } from 'next/server';
import { findAccountById, updateAccountById } from '@/features/test-module/auth/accounts-db';
import { readTestAuthSession } from '@/features/test-module/auth/session';

function publicProfile(account: Awaited<ReturnType<typeof findAccountById>>) {
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    role: account.role,
    display_name: account.display_name,
    faculty_id: account.faculty_id,
    registration_number: account.registration_number,
    section: account.section,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

export async function GET(req: NextRequest) {
  const session = readTestAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (session.role === 'admin') {
    return NextResponse.json({
      profile: {
        id: session.sub,
        email: session.email,
        role: 'admin',
        display_name: session.displayName,
        faculty_id: null,
        registration_number: null,
        section: null,
      },
    });
  }

  const account = await findAccountById(session.sub);
  if (!account || !account.is_active) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  return NextResponse.json({ profile: publicProfile(account) });
}

export async function PATCH(req: NextRequest) {
  const session = readTestAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (session.role === 'admin') {
    return NextResponse.json({ error: 'Admin profile is managed by environment configuration.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    display_name?: unknown;
    faculty_id?: unknown;
    registration_number?: unknown;
    section?: unknown;
  } | null;

  const account = await findAccountById(session.sub);
  if (!account || !account.is_active) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const displayName = typeof body?.display_name === 'string' ? body.display_name.trim() : account.display_name;
  const facultyId = typeof body?.faculty_id === 'string' ? body.faculty_id.trim() : account.faculty_id;
  const registrationNumber = typeof body?.registration_number === 'string'
    ? body.registration_number.trim()
    : account.registration_number;
  const section = typeof body?.section === 'string' ? body.section.trim() : account.section;

  if (!displayName) {
    return NextResponse.json({ error: 'Display name is required.' }, { status: 400 });
  }

  if (account.role === 'teacher' && !facultyId) {
    return NextResponse.json({ error: 'Faculty ID is required.' }, { status: 400 });
  }

  if (account.role === 'student' && (!registrationNumber || !section)) {
    return NextResponse.json({ error: 'Registration number and section are required.' }, { status: 400 });
  }

  const updated = await updateAccountById(account.id, {
    displayName,
    facultyId: account.role === 'teacher' ? facultyId : null,
    registrationNumber: account.role === 'student' ? registrationNumber : null,
    section: account.role === 'student' ? section : null,
  });

  return NextResponse.json({ profile: publicProfile(updated) });
}
