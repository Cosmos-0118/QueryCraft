import { NextResponse } from 'next/server';
import {
  addAssignmentToTest,
  listAssignmentsForTest,
  removeAssignmentFromTest,
} from '@/lib/test/test-module-db';

export async function GET(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const assignments = await listAssignmentsForTest(params.id);
  return NextResponse.json({ assignments });
}


export async function POST(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
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
