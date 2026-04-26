import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAccountById,
  findAccountById,
  updateAccountById,
  type TestAccountRole,
} from '@/lib/test-auth/accounts-db';
import { requireAdminSession } from '@/lib/test-auth/session';

function isValidRole(value: unknown): value is TestAccountRole {
  return value === 'teacher' || value === 'student';
}

async function resolveId(
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  const params = await Promise.resolve(context.params);
  return params.id;
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const id = await resolveId(context);
  const account = await findAccountById(id);
  if (!account) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  return NextResponse.json({ account });
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const id = await resolveId(context);
  const body = await req.json().catch(() => null) as {
    role?: unknown;
    display_name?: unknown;
    is_active?: unknown;
  } | null;

  const updates: Parameters<typeof updateAccountById>[1] = {};

  if (body && body.role !== undefined) {
    if (!isValidRole(body.role)) {
      return NextResponse.json({ error: "Role must be 'teacher' or 'student'." }, { status: 400 });
    }
    updates.role = body.role as TestAccountRole;
  }

  if (body && body.display_name !== undefined) {
    if (typeof body.display_name !== 'string') {
      return NextResponse.json({ error: 'display_name must be a string.' }, { status: 400 });
    }
    updates.displayName = body.display_name;
  }

  if (body && body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active must be a boolean.' }, { status: 400 });
    }
    updates.isActive = body.is_active;
  }

  try {
    const updated = await updateAccountById(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }
    return NextResponse.json({ account: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update account.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const id = await resolveId(context);
  const removed = await deleteAccountById(id);
  if (!removed) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
