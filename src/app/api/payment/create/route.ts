import { NextRequest, NextResponse } from 'next/server';
import { createPaymentOrder } from '@/lib/payment';
import { prisma } from '@/lib/db';
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
    const { galleryId, galleryName, amount, locale } = body;

    if (!galleryId || !galleryName || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // galleryId from frontend is the slug — resolve to DB ID
    let dbId = galleryId;
    const gallery = await prisma.gallery.findUnique({ where: { slug: galleryId } });
    if (gallery) {
      dbId = gallery.id;
    }

    const baseUrl = `${request.nextUrl.protocol}//${request.headers.get('host')}`;
    const order = await createPaymentOrder(
      dbId,
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
