import { NextResponse } from 'next/server';
import { clearUserCookie } from '@/lib/user-auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', clearUserCookie());
  return response;
}
