import { requireUserForPage } from '@/lib/user-auth';
import { prisma } from '@/lib/db';
import { toGallery } from '@/lib/data';
import { GalleryGrid } from '@/components/gallery/gallery-grid';
import { getTranslations } from 'next-intl/server';
import type { Gallery } from '@/types';

export default async function PurchasedPage() {
  const user = await requireUserForPage();
  const t = await getTranslations('user');

  const orders = await prisma.paymentOrder.findMany({
    where: { userId: user.id, status: 'paid' },
    include: { gallery: true },
    orderBy: { paidAt: 'desc' },
  });

  // Deduplicate by gallery id
  const seen = new Set<string>();
  const galleries: Gallery[] = [];
  for (const o of orders) {
    if (!o.gallery || seen.has(o.gallery.id)) continue;
    seen.add(o.gallery.id);
    galleries.push(toGallery(o.gallery));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('purchased')}</h1>
      {galleries.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          {t('noPurchased')}
        </p>
      ) : (
        <GalleryGrid galleries={galleries} />
      )}
    </div>
  );
}
