import { NextRequest, NextResponse } from 'next/server';
import {
  addAssignmentToTest,
  listAssignmentsForTest,
  removeAssignmentFromTest,
} from '@/lib/test/test-module-db';
import {
  ensureTeacherOwnsTest,
  requireTestActor,
} from '@/lib/security/test-module-security';

async function ensureTeacherAccess(req: NextRequest, testId: string) {
  const actorResult = requireTestActor(req, {
    allowedRoles: ['admin', 'teacher'],
  });
  if (!actorResult.ok) {
    return { error: actorResult.response };
  }

  const ownership = await ensureTeacherOwnsTest(actorResult.value, testId);
  if (!ownership.ok) {
    return { error: ownership.response };
  }

  return { error: null, actor: actorResult.value };
}

export async function GET(req: NextRequest, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const access = await ensureTeacherAccess(req, params.id);
  if (access.error) return access.error;

  const assignments = await listAssignmentsForTest(params.id);
  return NextResponse.json({ assignments });
}


export async function POST(req: NextRequest, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const access = await ensureTeacherAccess(req, params.id);
  if (access.error) return access.error;

  const body = await req.json();

  if (!body?.user || typeof body.user !== 'string') {
    return NextResponse.json({ error: 'User name is required.' }, { status: 400 });
  }
  if (body.role !== 'student' && body.role !== 'teacher') {
    return NextResponse.json({ error: 'Role must be student or teacher.' }, { status: 400 });
  }

  const assignment = await addAssignmentToTest(params.id, body.user.trim(), body.role);
  if (!assignment) {
    return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
  }

  return NextResponse.json({ assignment });
}


export async function DELETE(req: NextRequest, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const access = await ensureTeacherAccess(req, params.id);
  if (access.error) return access.error;

  const body = await req.json();

  if (!body?.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Assignment id is required.' }, { status: 400 });
  }

  const removed = await removeAssignmentFromTest(params.id, body.id);
  if (!removed) {
    return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
