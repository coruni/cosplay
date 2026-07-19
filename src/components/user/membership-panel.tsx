'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import {
  CrownIcon,
  SparklesIcon,
  CheckIcon,
  ArrowRightIcon,
  Loader2Icon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface MembershipPanelProps {
  isSubscribed: boolean;
  isActive: boolean;
  quotaTotal: number;
  quotaUsed: number;
  quotaRemaining: number;
  cycleEndAt: string | null;
  subscriptionEndAt: string | null;
  price: number;
  locale: string;
}

interface LiveStatus {
  isSubscribed: boolean;
  isActive: boolean;
  quotaTotal: number;
  quotaUsed: number;
  quotaRemaining: number;
  cycleEndAt: string | null;
  subscriptionEndAt: string | null;
}

export function MembershipPanel(props: MembershipPanelProps) {
  const t = useTranslations('subscription');
  const locale = useLocale();
  const [status, setStatus] = useState<LiveStatus>({
    isSubscribed: props.isSubscribed,
    isActive: props.isActive,
    quotaTotal: props.quotaTotal,
    quotaUsed: props.quotaUsed,
    quotaRemaining: props.quotaRemaining,
    cycleEndAt: props.cycleEndAt,
    subscriptionEndAt: props.subscriptionEndAt,
  });
  const [processing, setProcessing] = useState(false);

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const pct =
    status.quotaTotal > 0
      ? Math.round((status.quotaUsed / status.quotaTotal) * 100)
      : 0;

  const refresh = async () => {
    try {
      const me = await (await fetch('/api/user/me')).json();
      if (me.subscription) setStatus(me.subscription);
    } catch {
      /* ignore */
    }
  };

  const handleSubscribe = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error('create failed');

      if (order.paymentUrl && order.paymentUrl.includes('mock=true')) {
        // Mock mode: activate server-side
        await fetch('/api/subscription/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.orderId }),
        });
        await refresh();
        toast.success(t('success'));
      } else if (order.paymentUrl) {
        window.location.href = order.paymentUrl;
        return;
      }
    } catch {
      toast.error(t('processing'));
    } finally {
      setProcessing(false);
    }
  };

  const benefits = [
    t('benefit1', { quota: status.quotaTotal }),
    t('benefit2'),
    t('benefit3'),
  ];

  return (
    <div className="rounded-2xl p-6 bg-[#262633]/60 border border-white/[0.06] space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center size-11 rounded-xl bg-[#ff2d78]/15 border border-[#ff2d78]/30"
            style={{ boxShadow: '0 0 20px rgba(255,45,120,0.15)' }}
          >
            <CrownIcon className="size-5 text-[#ff2d78]" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t('title')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('benefitTitle')}</p>
          </div>
        </div>
        <span
          className={
            'text-xs font-medium px-3 py-1 rounded-full ' +
            (status.isActive
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-white/[0.06] text-muted-foreground')
          }
        >
          {status.isActive ? t('active') : t('inactive')}
        </span>
      </div>

      {/* Quota progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('quotaTitle')}</span>
          <span className="text-foreground font-medium tabular-nums">
            {t('quotaUsed', {
              used: status.quotaUsed,
              total: status.quotaTotal,
            })}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#ff2d78]"
            style={{ boxShadow: '0 0 12px rgba(255,45,120,0.4)' }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{t('quotaRemaining', { remaining: status.quotaRemaining })}</span>
          {status.cycleEndAt && (
            <span>{t('cycleReset', { date: fmtDate(status.cycleEndAt) })}</span>
          )}
        </div>
      </div>

      {/* Expiry */}
      {status.isSubscribed && status.subscriptionEndAt && (
        <p className="text-xs text-muted-foreground">
          {t('expiry', { date: fmtDate(status.subscriptionEndAt) })}
        </p>
      )}

      {/* Benefits */}
      <ul className="space-y-2">
        {benefits.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckIcon className="size-4 text-[#ff2d78] mt-0.5 shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {/* Action */}
      <Button
        onClick={handleSubscribe}
        disabled={processing}
        className="w-full h-12 bg-[#ff2d78] hover:bg-[#ff2d78]/90 text-white font-semibold"
        style={{ boxShadow: '0 0 20px rgba(255,45,120,0.3)' }}
      >
        {processing ? (
          <span className="flex items-center gap-2">
            <Loader2Icon className="size-4 animate-spin" />
            {t('processing')}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <SparklesIcon className="size-4" />
            {status.isActive ? t('renew') : t('subscribe')}
            <span className="opacity-80">· {t('price', { price: props.price })}</span>
            <ArrowRightIcon className="size-4" />
          </span>
        )}
      </Button>
    </div>
  );
}
