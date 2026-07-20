'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2Icon,
  CreditCardIcon,
  DollarSignIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocale, useTranslations } from 'next-intl';

interface PaymentOrder {
  id: string;
  orderId: string;
  galleryId: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  gallery?: { slug: string; titleZh: string };
}

interface Stats {
  totalRevenue: number;
  totalPaid: number;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const t = useTranslations('admin.orders');
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState<Stats>({ totalRevenue: 0, totalPaid: 0 });
  const locale = useLocale();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), status: statusFilter });
      const res = await fetch(`/admin/api/orders?${params}`);
      if (res.status === 401) { router.push(`/${locale}/admin/login`); return; }
      const data = await res.json();
      setOrders(data.items);
      setTotalPages(data.totalPages);
      setStats(data.stats);
    } catch (e) {
      console.error('Fetch orders failed:', e);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, router]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const statusBadge = (status: string) => {
    const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
      paid: {
        icon: <CheckCircleIcon className="size-3" />,
        label: t('filterPaid'),
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      },
      pending: {
        icon: <ClockIcon className="size-3" />,
        label: t('filterPending'),
        className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      },
      failed: {
        icon: <XCircleIcon className="size-3" />,
        label: t('filterFailed'),
        className: 'bg-red-500/10 text-red-400 border-red-500/20',
      },
    };
    const c = config[status] || config.pending;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', c.className)}>
        {c.icon}
        {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-5 bg-[#262633] border border-white/[0.06] flex items-center gap-4">
          <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <DollarSignIcon className="size-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">¥{stats.totalRevenue.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">{t('totalRevenue')}</p>
          </div>
        </div>
        <div className="rounded-xl p-5 bg-[#262633] border border-white/[0.06] flex items-center gap-4">
          <div className="size-10 rounded-lg bg-[#a855f7]/10 flex items-center justify-center">
            <CreditCardIcon className="size-5 text-[#a855f7]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.totalPaid}</p>
            <p className="text-sm text-muted-foreground">{t('paidOrders')}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <FilterIcon className="size-4 text-muted-foreground" />
        {[
          { value: '', label: t('filterAll') },
          { value: 'paid', label: t('filterPaid') },
          { value: 'pending', label: t('filterPending') },
          { value: 'failed', label: t('filterFailed') },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              statusFilter === f.value
                ? 'bg-[#ff2d78]/15 text-[#ff2d78] border border-[#ff2d78]/20'
                : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-white/[0.04]'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="rounded-xl bg-[#262633] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{t('colOrder')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{t('colGallery')}</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">{t('colAmount')}</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">{t('colStatus')}</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">{t('colTime')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2Icon className="size-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <CreditCardIcon className="size-8 mx-auto mb-2 opacity-40" />
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{order.orderId}</td>
                    <td className="px-4 py-3 text-foreground">
                      {order.gallery?.titleZh || '—'}
                      {order.gallery?.slug && (
                        <p className="text-xs text-muted-foreground">/{order.gallery.slug}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#22c55e] font-medium tabular-nums">
                      ¥{order.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">{statusBadge(order.status)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                      {new Date(order.createdAt).toLocaleString(locale === 'en' ? 'en-US' : locale === 'ja' ? 'ja-JP' : 'zh-CN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <span className="text-xs text-muted-foreground">
              {t('page', { page, total: totalPages })}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="size-8"
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="size-8"
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
