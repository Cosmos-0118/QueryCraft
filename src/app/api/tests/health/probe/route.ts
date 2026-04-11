import { NextResponse } from 'next/server';
import { probeTestDbConnection } from '@/lib/test-db/probe';

export const runtime = 'nodejs';

export async function GET() {
  try {
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