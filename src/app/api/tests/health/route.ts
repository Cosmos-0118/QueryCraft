import { NextRequest, NextResponse } from 'next/server';
import { bootstrapTestDbConnection } from '@/lib/test-db/bootstrap';
import { requireTestActor } from '@/lib/security/test-module-security';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const actorResult = requireTestActor(req, {
      allowedRoles: ['admin'],
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const state = bootstrapTestDbConnection();

    return NextResponse.json({
      service: 'test-db',
      ...state,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        service: 'test-db',
        status: 'error',
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unable to evaluate Test DB health.',
      },
      { status: 500 },
    );
  }
}