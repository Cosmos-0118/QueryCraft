import { NextRequest, NextResponse } from 'next/server';
import {
  createAccount,
  listAccounts,
  type TestAccountRole,
} from '@/lib/test-auth/accounts-db';
import { requireAdminSession } from '@/lib/test-auth/session';

function isValidRole(value: unknown): value is TestAccountRole {
  return value === 'teacher' || value === 'student';
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function GET(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const accounts = await listAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to list accounts.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null) as {
      email?: unknown;
      role?: unknown;
      display_name?: unknown;
    } | null;

    if (!isValidEmail(body?.email)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    if (!isValidRole(body?.role)) {
      return NextResponse.json({ error: "Role must be 'teacher' or 'student'." }, { status: 400 });
    }

    const displayName = typeof body?.display_name === 'string' ? body.display_name.trim() : undefined;

    const outcome = await createAccount({
      email: body.email as string,
      role: body.role as TestAccountRole,
      displayName,
    });

    return NextResponse.json(
      { account: outcome.account, created: outcome.created },
      { status: outcome.created ? 201 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create account.' },
      { status: 500 },
    );
  }
}
