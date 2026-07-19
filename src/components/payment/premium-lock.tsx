'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { LockIcon, CrownIcon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Gallery } from '@/types';
import { toast } from 'sonner';

interface PremiumLockProps {
  gallery: Gallery;
  isPurchased?: boolean;
  className?: string;
}

export function PremiumLock({ gallery, isPurchased = false, className }: PremiumLockProps) {
  const t = useTranslations();
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localUnlock, setLocalUnlock] = useState(false);
  const unlocked = isPurchased || localUnlock;

  const title = gallery.title[locale as keyof typeof gallery.title] || gallery.title.zh;

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          galleryId: gallery.slug,
          galleryName: title,
          amount: gallery.price,
        }),
      });

      if (!response.ok) throw new Error('Payment creation failed');

      const order = await response.json();

      if (order.paymentUrl) {
        // In mock mode, simulate success
        if (order.paymentUrl.includes('mock=true')) {
          toast.success(t('payment.success'));
          setLocalUnlock(true);
          setPayDialogOpen(false);
        } else {
          window.location.href = order.paymentUrl;
        }
      }
    } catch {
      toast.error(t('payment.failed'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (unlocked) {
    return null;
  }

  return (
    <>
      <div className={cn('relative', className)}>
        {/* Blur overlay */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1c1c28]/60 backdrop-blur-md rounded-xl">
          <motion.div
            initial={shouldReduceMotion ? undefined : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="text-center p-6"
          >
            <div
              className="mx-auto size-16 rounded-full bg-[#ff2d78]/10 flex items-center justify-center mb-4"
              style={{
                boxShadow: '0 0 30px rgba(255,45,120,0.2)',
              }}
            >
              <LockIcon className="size-7 text-[#ff2d78]" />
            </div>
            <h3
              className="text-xl font-bold text-white mb-2"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              {t('detail.unlock')}
            </h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              {t('detail.unlockPrice', {
                price: gallery.price,
                count: gallery.images.length,
              })}
            </p>
            <Button
              onClick={() => setPayDialogOpen(true)}
              className="bg-[#ff2d78] hover:bg-[#ff2d78]/90 text-white font-semibold px-8"
              style={{
                boxShadow: '0 0 24px rgba(255,45,120,0.4)',
              }}
            >
              <CrownIcon className="mr-2 size-4" />
              {t('payment.payNow')}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="bg-[#262633] border-white/[0.08] max-w-md">
          <DialogHeader>
            <DialogTitle
              className="text-xl"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <SparklesIcon className="inline-block mr-2 size-5 text-[#ff2d78]" />
              {t('payment.title')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('payment.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Order summary */}
            <div className="rounded-lg border border-white/[0.06] bg-[#1c1c28]/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('detail.cosplayer')}</span>
                <span className="text-foreground">{gallery.cosplayer}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('detail.character')}</span>
                <span className="text-foreground">{gallery.character}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('detail.images')}</span>
                <span className="text-foreground">{gallery.images.length} {locale === 'ja' ? '枚' : 'images'}</span>
              </div>
              <div className="border-t border-white/[0.06] pt-2 flex justify-between">
                <span className="font-medium text-foreground">{t('payment.amount')}</span>
                <span
                  className="text-xl font-bold"
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    color: '#ff2d78',
                  }}
                >
                  ¥{gallery.price}
                </span>
              </div>
            </div>

            {/* Pay buttons */}
            <div className="space-y-3">
              <Button
                onClick={handlePay}
                disabled={isProcessing}
                className="w-full h-12 bg-[#ff2d78] hover:bg-[#ff2d78]/90 text-white font-semibold"
                style={{
                  boxShadow: '0 0 20px rgba(255,45,120,0.3)',
                }}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('payment.processing')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <SparklesIcon className="size-4" />
                    ¥{gallery.price} — {t('payment.payNow')}
                  </span>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground/60">
                {t('payment.payWithAlipay')} / {t('payment.payWithWechat')}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
