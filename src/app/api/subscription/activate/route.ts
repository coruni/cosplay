import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';
import { activateSubscription, getSubscriptionStatus } from '@/lib/subscription';

/**
 * Mock-mode activation. In dev (no YIPAY_PID), the success page can't
 * receive a server webhook, so the client calls this after simulating payment.
 * Verifies the order belongs to the user and is a subscription order,
 * then activates the membership server-side (authoritative state).
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

    const body = await request.json().catch(() => ({}));
    const { orderId } = body;

    if (orderId) {
      const order = await prisma.paymentOrder.findUnique({
        where: { orderId },
      });
      if (
        !order ||
        order.userId !== user.id ||
        order.type !== 'subscription'
      ) {
        return NextResponse.json(
          { error: 'Invalid order' },
          { status: 400 }
        );
      }
    }

    await activateSubscription(user.id);
    const subscription = await getSubscriptionStatus(user.id);
    return NextResponse.json(subscription);
  } catch (error) {
    console.error('[Subscription Activate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to activate subscription' },
      { status: 500 }
    );
  }
}
