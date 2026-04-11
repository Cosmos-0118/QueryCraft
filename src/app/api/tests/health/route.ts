import { NextResponse } from 'next/server';
import { bootstrapTestDbConnection } from '@/lib/test-db/bootstrap';

export const runtime = 'nodejs';

export async function GET() {
  try {
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