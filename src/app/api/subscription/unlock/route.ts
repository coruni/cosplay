import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';
import { consumeQuotaTx } from '@/lib/subscription';

/**
 * Member download & permanent unlock of a gallery, consuming 1 unit of monthly quota.
 *
 * - Requires an active subscription (consumeQuotaTx returns 'inactive' otherwise).
 * - Records a PAID GALLERY order so the gallery becomes permanently owned
 *   (hasPurchasedGallery / "once unlocked, always available"), surviving quota
 *   resets and membership expiry.
 * - Increments the gallery downloadCount as a proxy for the gated download.
 *
 * All three writes run inside a single `prisma.$transaction` so that if any
 * step fails (e.g. paymentOrder.create throws), the quota increment is rolled
 * back too — no single-sided quota deduction can persist.
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

    const body = await request.json();
    const { galleryId } = body;
    if (!galleryId) {
      return NextResponse.json(
        { error: 'Missing galleryId' },
        { status: 400 }
      );
    }

    // galleryId from frontend is the slug — resolve to DB ID
    let dbId = galleryId;
    const gallery = await prisma.gallery.findUnique({ where: { slug: galleryId } });
    if (gallery) dbId = gallery.id;

    const result = await prisma.$transaction(async (tx) => {
      const r = await consumeQuotaTx(tx, user.id);
      if (!r.ok) return r;

      // Permanently own the gallery via a paid GALLERY order (not 'subscription',
      // which the payment notify treats as a membership activation).
      await tx.paymentOrder.create({
        data: {
          orderId: `ULK${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          galleryId: dbId,
          amount: 0,
          status: 'paid',
          type: 'gallery',
          userId: user.id,
          paidAt: new Date(),
        },
      });

      // Proxy metric for the (gated) download that follows.
      await tx.gallery.update({
        where: { id: dbId },
        data: { downloadCount: { increment: 1 } },
      });

      return r;
    });

    if (!result.ok) {
      const status = result.reason === 'exhausted' ? 402 : 403;
      return NextResponse.json(
        { error: result.reason, remaining: result.remaining },
        { status }
      );
    }

    return NextResponse.json({ ok: true, remaining: result.remaining });
  } catch (error) {
    console.error('[Subscription Unlock] Error:', error);
    return NextResponse.json(
      { error: 'Failed to unlock with quota' },
      { status: 500 }
    );
  }
}
