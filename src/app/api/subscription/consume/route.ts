import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-auth';
import { consumeQuota } from '@/lib/subscription';

/**
 * Consume 1 unit of monthly quota for a download action.
 * Returns { ok, remaining } or { ok:false, reason } when inactive/exhausted.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'loginRequired', requireLogin: true },
        { status: 401 }
      );
    }

    const result = await consumeQuota(user.id);
    if (!result.ok) {
      const status = result.reason === 'exhausted' ? 402 : 403;
      return NextResponse.json(
        { error: result.reason, remaining: result.remaining },
        { status }
      );
    }

    return NextResponse.json({ ok: true, remaining: result.remaining });
  } catch (error) {
    console.error('[Subscription Consume] Error:', error);
    return NextResponse.json(
      { error: 'Failed to consume quota' },
      { status: 500 }
    );
  }
}
