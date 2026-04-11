import { NextRequest, NextResponse } from 'next/server';
import { joinPublishedTestByCode } from '@/lib/test/test-module-db';

// POST /api/tests/join
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.code || typeof body.code !== 'string') {
      return NextResponse.json({ error: 'Test code is required.' }, { status: 400 });
    }
    if (!body?.student_id || typeof body.student_id !== 'string') {
      return NextResponse.json({ error: 'Student id is required.' }, { status: 400 });
    }
    if (!body?.student_name || typeof body.student_name !== 'string') {
      return NextResponse.json({ error: 'Student name is required.' }, { status: 400 });
    }

    const test = await joinPublishedTestByCode({
      code: body.code,
      studentId: body.student_id,
      studentName: body.student_name,
    });

    return NextResponse.json({ test }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to join test.' },
      { status: 400 },
    );
  }
}
