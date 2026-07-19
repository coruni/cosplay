import Link from 'next/link';
import { requireUserForPage } from '@/lib/user-auth';
import { prisma } from '@/lib/db';
import { getTranslations, getLocale } from 'next-intl/server';
import { cn } from '@/lib/utils';
import type { Locale } from '@/types';

export default async function OrdersPage() {
  const user = await requireUserForPage();
  const t = await getTranslations('user');
  const locale = (await getLocale()) as Locale;

  const orders = await prisma.paymentOrder.findMany({
    where: { userId: user.id },
    include: {
      gallery: {
        select: { slug: true, titleZh: true, titleEn: true, titleJa: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const statusColor = (status: string) =>
    status === 'paid'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : status === 'pending'
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        : 'bg-red-500/15 text-red-400 border-red-500/30';

  const statusLabel = (status: string) =>
    status === 'paid'
      ? t('statusPaid')
      : status === 'pending'
        ? t('statusPending')
        : t('statusFailed');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('orders')}</h1>

      {orders.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          {t('noOrders')}
        </p>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">
                  {t('orderId')}
                </th>
                <th className="text-left px-4 py-3 font-medium">Gallery</th>
                <th className="text-left px-4 py-3 font-medium">
                  {t('orderAmount')}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t('orderStatus')}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t('orderDate')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {orders.map((o) => {
                const title = o.gallery
                  ? locale === 'zh'
                    ? o.gallery.titleZh
                    : locale === 'ja'
                      ? o.gallery.titleJa
                      : o.gallery.titleEn
                  : '—';
                return (
                  <tr key={o.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {o.orderId}
                    </td>
                    <td className="px-4 py-3">
                      {o.gallery ? (
                        <Link
                          href={`/${locale}/gallery/${o.gallery.slug}`}
                          className="text-foreground hover:text-[#ff2d78] transition-colors"
                        >
                          {title}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      ¥{o.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex px-2.5 py-1 rounded-full text-xs font-medium border',
                          statusColor(o.status)
                        )}
                      >
                        {statusLabel(o.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString(locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
