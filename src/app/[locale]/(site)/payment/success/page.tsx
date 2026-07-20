import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { confirmPayment, getPaymentOrder, isMockPaymentEnabled } from '@/lib/payment';
import { activateSubscription } from '@/lib/subscription';
import { prisma } from '@/lib/db';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default async function PaymentSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ orderId?: string; gallerySlug?: string; type?: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'payment' });
  const sp = await searchParams;

  // Auto-confirm ONLY in mock mode. This page is the gateway return_url (a
  // browser redirect the user controls), so it must NEVER be trusted to confirm
  // a real payment — anyone could hit /payment/success?orderId=xxx and unlock
  // for free. In production, confirmation/activation happens solely via the
  // signed server webhook at /api/payment/notify.
  if (isMockPaymentEnabled() && sp.orderId) {
    try {
      const order = await prisma.paymentOrder.findUnique({
        where: { orderId: sp.orderId },
      });
      if (order?.type === 'subscription') {
        // Subscription orders activate membership instead of unlocking a gallery
        if (order.userId) await activateSubscription(order.userId);
      } else {
        await confirmPayment(sp.orderId);
      }
    } catch {
      // Order may already be confirmed
    }
  }

  // Get order details from database
  let order = null;
  if (sp.orderId) {
    order = await getPaymentOrder(sp.orderId);
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="mb-8">
          <div className="mx-auto size-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4"
            style={{
              boxShadow: '0 0 40px rgba(34,197,94,0.2), inset 0 0 20px rgba(34,197,94,0.05)',
            }}
          >
            <CheckCircle2 className="size-10 text-emerald-400" />
          </div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            {t('success')}
          </h1>
          <p className="text-muted-foreground">{t('successDesc')}</p>
          {sp.orderId && (
            <p className="text-xs text-muted-foreground/60 mt-2">
              {t('orderId')}: {sp.orderId}
            </p>
          )}
          {order && (
            <p className="text-sm text-emerald-400/80 mt-1">
              ¥{order.amount.toFixed(2)} — {order.status === 'paid' ? t('statusPaid') : t('statusProcessing')}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {sp.gallerySlug && (
            <Link href={`/${locale}/gallery/${sp.gallerySlug}`}>
              <Button
                className="bg-[#ff2d78] hover:bg-[#ff2d78]/90 text-white"
                style={{
                  boxShadow: '0 0 20px rgba(255,45,120,0.3)',
                }}
              >
                {t('viewContent')}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
          )}
          <Link href={`/${locale}/gallery`}>
            <Button
              variant="outline"
              className="border-white/10 hover:bg-white/[0.04]"
            >
              {t('backToGallery')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
