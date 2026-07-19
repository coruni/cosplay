import { NextRequest, NextResponse } from 'next/server';
import { createPaymentOrder } from '@/lib/payment';
import { getCurrentUser } from '@/lib/user-auth';

const SUBSCRIPTION_PRICE = Number(process.env.SUBSCRIPTION_PRICE) || 30;

export async function POST(request: NextRequest) {
  try {
    // Require login
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'loginRequired', requireLogin: true },
        { status: 401 }
      );
    }

    const { locale } = await request.json().catch(() => ({ locale: 'zh' }));
    const baseUrl = `${request.nextUrl.protocol}//${request.headers.get('host')}`;
    const order = await createPaymentOrder(
      null, // subscription orders are not tied to a gallery
      'CosHub 会员订阅',
      SUBSCRIPTION_PRICE,
      baseUrl,
      user.id,
      'subscription',
      locale || 'zh'
    );

    return NextResponse.json(order);
  } catch (error) {
    console.error('[Subscription Create] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription order' },
      { status: 500 }
    );
  }
}
