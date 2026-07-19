import { NextRequest, NextResponse } from 'next/server';
import { createPaymentOrder } from '@/lib/payment';
import { getCurrentUser } from '@/lib/user-auth';

export async function POST(request: NextRequest) {
  try {
    // Require login — purchases must be tied to a user for the "purchased" list
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'loginRequired', requireLogin: true },
        { status: 401 }
      );
    }

    const body = await request.json();
    // body.galleryId is actually the gallery SLUG (frontend naming). Pass it
    // through to createPaymentOrder, which now resolves slug → DB id itself.
    const { galleryId: gallerySlug, galleryName, amount, locale } = body;

    if (!gallerySlug || !galleryName || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const baseUrl = `${request.nextUrl.protocol}//${request.headers.get('host')}`;
    const order = await createPaymentOrder(
      gallerySlug,
      galleryName,
      amount,
      baseUrl,
      user.id,
      'gallery',
      locale || 'zh'
    );

    return NextResponse.json(order);
  } catch (error) {
    console.error('[Payment API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment order' },
      { status: 500 }
    );
  }
}
