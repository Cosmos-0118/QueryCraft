import { NextResponse } from 'next/server';
import {
  addAssignmentToTest,
  getTestById,
  listAssignmentsForTest,
  removeAssignmentFromTest,
} from '@/lib/test/test-module-db';

async function ensureTeacherAccess(req: Request, testId: string) {
  const searchParams = new URL(req.url).searchParams;
  const role = searchParams.get('role');
  const userId = searchParams.get('userId')?.trim();

  if (role !== 'teacher' || !userId) {
    return { error: NextResponse.json({ error: 'Teacher userId is required.' }, { status: 400 }) };
  }

  const test = await getTestById(testId);
  if (!test) {
    return { error: NextResponse.json({ error: 'Test not found.' }, { status: 404 }) };
  }

  if (test.created_by !== userId) {
    return { error: NextResponse.json({ error: 'You do not have access to this test.' }, { status: 403 }) };
  }

  return { error: null };
}

export async function GET(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const access = await ensureTeacherAccess(req, params.id);
  if (access.error) return access.error;

  const assignments = await listAssignmentsForTest(params.id);
  return NextResponse.json({ assignments });
}


export async function POST(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
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


export async function DELETE(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
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
