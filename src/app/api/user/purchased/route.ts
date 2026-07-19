import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';
import { resolveImageUrl } from '@/lib/s3';
import type { Gallery, Locale } from '@/types';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find all paid GALLERY orders for this user, include gallery.
  // Only type:'gallery' paid orders represent an owned gallery — subscription
  // orders (type:'subscription') are membership activations and must be excluded.
  const orders = await prisma.paymentOrder.findMany({
    where: { userId: user.id, status: 'paid', type: 'gallery' },
    include: { gallery: true },
    orderBy: { paidAt: 'desc' },
  });

  // Deduplicate by galleryId (a user may have multiple paid orders for one gallery)
  const seen = new Set<string>();
  const galleries: Gallery[] = [];

  for (const order of orders) {
    const g = order.gallery;
    if (!g || seen.has(g.id)) continue;
    seen.add(g.id);

    const title: Record<Locale, string> = {
      zh: g.titleZh,
      en: g.titleEn,
      ja: g.titleJa,
    };
    const description: Record<Locale, string> = {
      zh: g.descriptionZh,
      en: g.descriptionEn,
      ja: g.descriptionJa,
    };

    galleries.push({
      id: g.id,
      slug: g.slug,
      title,
      description,
      cosplayer: g.cosplayer,
      character: g.character,
      series: g.series,
      cover: resolveImageUrl(g.cover),
      images: g.images.map(resolveImageUrl),
      categories: g.categories,
      tags: g.tags,
      rating: g.rating as 'sfw' | 'nsfw',
      price: g.price,
      isPremium: g.isPremium,
      createdAt: g.createdAt.toISOString(),
      viewCount: g.viewCount,
      downloadCount: g.downloadCount,
    });
  }

  return NextResponse.json({ items: galleries });
}
