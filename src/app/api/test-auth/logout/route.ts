import { NextResponse } from 'next/server';
import { clearTestAuthCookie } from '@/features/test-module/auth/session';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearTestAuthCookie(response);
  return response;
}
