import { NextRequest, NextResponse } from 'next/server';
import { verifyPaymentNotify, confirmPayment } from '@/lib/payment';
import { activateSubscription } from '@/lib/subscription';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const data: Record<string, string> = {};
    params.forEach((value, key) => {
      data[key] = value;
    });

    console.log('[Payment Notify] Received:', data);

    // Verify signature
    const isValid = verifyPaymentNotify(data);
    if (!isValid) {
      console.error('[Payment Notify] Invalid signature');
      return new NextResponse('fail', { status: 400 });
    }

    // Confirm payment in database
    const orderId = data.out_trade_no;
    if (orderId) {
      const order = await prisma.paymentOrder.findUnique({
        where: { orderId },
      });
      if (order?.type === 'subscription') {
        if (order.userId) await activateSubscription(order.userId);
        console.log('[Payment Notify] Subscription activated:', orderId);
      } else {
        await confirmPayment(orderId);
        console.log('[Payment Notify] Order confirmed:', orderId);
      }
    }

    return new NextResponse('success');
  } catch (error) {
    console.error('[Payment Notify] Error:', error);
    return new NextResponse('fail', { status: 500 });
  }
}
