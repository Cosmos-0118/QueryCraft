import { NextRequest, NextResponse } from 'next/server';
import { joinPublishedTestByCode } from '@/lib/test/test-module-db';
import { requireTestActor } from '@/lib/security/test-module-security';

// POST /api/tests/join
export async function POST(req: NextRequest) {
  try {
    const actorResult = requireTestActor(req, {
      allowedRoles: ['student'],
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const body = await req.json();

    if (!body?.code || typeof body.code !== 'string') {
      return NextResponse.json({ error: 'Test code is required.' }, { status: 400 });
    }

    const actor = actorResult.value;

    const test = await joinPublishedTestByCode({
      code: body.code,
      studentId: actor.primaryUserId,
      studentName: actor.displayName,
    });

    return NextResponse.json({ test }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to join test.' },
      { status: 400 },
    );
  }
}
