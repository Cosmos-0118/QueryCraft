import { NextResponse } from 'next/server';
import { clearTestAuthCookie } from '@/lib/test-auth/session';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearTestAuthCookie(response);
  return response;
}
