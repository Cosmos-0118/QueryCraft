import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from './tokens';

export interface AuthenticatedRequest {
  userId: string;
  email: string;
}

export async function requireAuth(
  request: NextRequest,
): Promise<AuthenticatedRequest | NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyAccessToken(token);
    return { userId: payload.sub, email: payload.email };
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}

export function isAuthError(result: AuthenticatedRequest | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
