import { NextRequest, NextResponse } from 'next/server';
import { probeTestDbConnection } from '@/lib/test-db/probe';
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

    const probe = await probeTestDbConnection();

    if (probe.status === 'error') {
      return NextResponse.json(probe, { status: 503 });
    }

    return NextResponse.json(probe);
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unexpected Test DB probe failure.',
      },
      { status: 500 },
    );
  }
}