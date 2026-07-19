import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';
import { activateSubscription, getSubscriptionStatus } from '@/lib/subscription';
import { isMockPaymentEnabled } from '@/lib/payment';

/**
 * Mock-mode activation. In dev (no YIPAY_PID), the success page can't
 * receive a server webhook, so the client calls this after simulating payment.
 * Verifies the order belongs to the user and is a subscription order,
 * then activates the membership server-side (authoritative state).
 *
 * SECURITY: this endpoint self-activates membership without a real payment, so
 * it MUST be disabled in production. There, activation happens only via the
 * gateway webhook (/api/payment/notify). Otherwise any logged-in user could
 * create a subscription order and grant themselves a free membership.
 */
export async function POST(request: NextRequest) {
  try {
    // 生产环境（或已配置真实网关）禁用自助激活，会员只能靠支付回调激活。
    if (!isMockPaymentEnabled()) {
      return NextResponse.json(
        { error: 'Not available in production' },
        { status: 403 }
      );
    }

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

      // Mark the order as paid so admin reports / revenue aggregates reflect
      // the mock activation. Without this the order stays 'pending' forever
      // even though the membership is active.
      await prisma.paymentOrder.update({
        where: { orderId },
        data: { status: 'paid', paidAt: new Date() },
      });
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
