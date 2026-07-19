'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LockIcon,
  UnlockIcon,
  EyeIcon,
  EyeOffIcon,
  DownloadIcon,
  ExternalLinkIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
} from 'lucide-react';
import { useNsfwStore } from '@/lib/nsfw-store';
import { getRatingLabel, getRatingColor } from '@/lib/content-filter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Gallery } from '@/types';
import { redirectToGateway } from '@/lib/payment-redirect';

interface GalleryDetailClientProps {
  gallery: Gallery;
  isPurchased: boolean;
  membershipActive?: boolean;
  quotaRemaining?: number;
}

/**
 * GalleryDetailClient — handles all client-side interactions for the gallery detail page.
 *
 * Features:
 * - Image grid with blur overlay for premium/locked images
 * - Unlock button that triggers payment flow
 * - NSFW content blur with reveal toggle
 * - Lightbox image viewer with keyboard navigation
 * - Age verification gate for NSFW content
 * - All touch targets ≥ 44×44px
 * - Toast notifications for payment flow
 */
export function GalleryDetailClient({
  gallery,
  isPurchased,
  membershipActive = false,
  quotaRemaining = 0,
}: GalleryDetailClientProps) {
  const t = useTranslations('detail');
  const tSub = useTranslations('subscription');
  const locale = useLocale();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const { showNsfw, ageConfirmed, confirmAge } = useNsfwStore();

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [localUnlock, setLocalUnlock] = useState(false);
  const [quota, setQuota] = useState(quotaRemaining);
  const isOwned = isPurchased;
  const [nsfwRevealed, setNsfwRevealed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  // Touch swipe tracking for the lightbox (mobile).
  const lightboxTouchStart = useRef<{ x: number; y: number } | null>(null);
  const lightboxSwiped = useRef(false);
  const [showAgeGate, setShowAgeGate] = useState(false);

  const isNsfw = gallery.rating === 'nsfw';
  // `isGated` = the gallery is restricted to subscribers (members-only) or buyers.
  //   - isPaid (price > 0): non-members may purchase it individually; members view free.
  //   - !isPaid (price == 0): members-only — non-members cannot buy, they must subscribe.
  const isGated = gallery.isPremium;
  const isPaid = isGated && gallery.price > 0;
  // Members view all gated galleries for free; non-members must own (purchase) or subscribe.
  // Downloading as a member consumes 1 quota and permanently unlocks the gallery.
  const canViewAll = !isGated || isOwned || localUnlock || membershipActive;
  const previewCount = 3;
  const allImages = gallery.images;
  const visibleImages = canViewAll ? allImages : allImages.slice(0, previewCount);
  const lockedImages = canViewAll ? [] : allImages.slice(previewCount);

  // When the gallery has an external download link (网盘/外部链接), the download
  // button jumps out to that source; otherwise it bundles the on-site images.
  const hasExternal = Boolean(gallery.downloadUrl);
  const DownloadGlyph = hasExternal ? ExternalLinkIcon : DownloadIcon;
  const downloadLabel = hasExternal
    ? t('downloadExternalLabel')
    : (isOwned || localUnlock
        ? t('downloadAll')
        : tSub('downloadWithQuota', { remaining: quota }));

  // Determine if images should be blurred (NSFW + not revealed)
  const shouldBlur = isNsfw && !nsfwRevealed;

  // Age gate check
  const handleNsfwReveal = useCallback(() => {
    if (ageConfirmed) {
      setNsfwRevealed(true);
    } else {
      setShowAgeGate(true);
    }
  }, [ageConfirmed]);

  const handleAgeConfirm = useCallback(() => {
    confirmAge();
    setNsfwRevealed(true);
    setShowAgeGate(false);
    // Re-render the server tree so related galleries respect the NSFW preference.
    router.refresh();
  }, [confirmAge, router]);

  // Per-gallery purchase (single buy). Shown to non-members / expired members
  // who don't yet own the gallery — buying grants permanent ownership.
  const handleUnlock = useCallback(async () => {
    setIsUnlocking(true);
    try {
      const title =
        gallery.title[locale as keyof typeof gallery.title] ?? gallery.title.en;

      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          galleryId: gallery.slug,
          galleryName: title,
          amount: gallery.price,
          locale,
        }),
      });

      if (response.status === 401) {
        router.push(
          `/${locale}/login?redirect=/${locale}/gallery/${gallery.slug}`
        );
        return;
      }
      if (!response.ok) throw new Error('Payment creation failed');

      const order = await response.json();

      if (order.paymentUrl) {
        // In mock mode, simulate successful payment
        if (order.paymentUrl.includes('mock=true')) {
          setLocalUnlock(true);
          toast.success(t('alreadyUnlocked'));
        } else {
          // Real payment flow — redirect (兼容 iOS Safari 等严格浏览器)
          redirectToGateway(order.paymentUrl);
        }
      }
    } catch (error) {
      console.error('Unlock failed:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  }, [gallery, locale, t, router]);

  // Download the gallery.
  // - Already owned (purchased or previously unlocked) → free download.
  // - Member free-view but not yet owned → consume 1 quota, permanently unlock
  //   (own) the gallery, then download ("一次解锁始终可用").
  // - If the gallery has an external download link (网盘/外部链接), we open that
  //   link in a new tab instead of bundling the on-site images.
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      if (!isOwned && !localUnlock) {
        if (!membershipActive) {
          router.push(
            `/${locale}/login?redirect=/${locale}/gallery/${gallery.slug}`
          );
          return;
        }
        const res = await fetch('/api/subscription/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ galleryId: gallery.slug }),
        });
        if (!res.ok) {
          if (res.status === 401) {
            router.push(
              `/${locale}/login?redirect=/${locale}/gallery/${gallery.slug}`
            );
            return;
          }
          toast.error(tSub('quotaUsedUp'));
          return;
        }
        setLocalUnlock(true);
        setQuota((q) => Math.max(0, q - 1));
      }

      // Record a download event (fire-and-forget; non-fatal).
      fetch(`/api/gallery/${gallery.slug}/download`, { method: 'POST' }).catch(
        () => {}
      );

      // On-site images are NOT directly downloadable. The only download path is
      // the external link (网盘/外部链接), which we open in a new tab.
      if (gallery.downloadUrl) {
        window.open(gallery.downloadUrl, '_blank', 'noopener,noreferrer');
        toast.success(t('downloadExternal'));
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }, [isOwned, localUnlock, membershipActive, locale, router, t, tSub, gallery.slug, gallery.downloadUrl]);

  // Lightbox
  const openLightbox = useCallback(
    (index: number) => {
      // Don't open lightbox for locked images
      const imagePath = allImages[index];
      if (lockedImages.includes(imagePath)) return;
      setLightboxIndex(index);
      setLightboxOpen(true);
    },
    [allImages, lockedImages]
  );

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const lightboxPrev = useCallback(() => {
    setLightboxIndex((prev) => {
      let next = prev - 1;
      while (next >= 0 && lockedImages.includes(allImages[next])) next--;
      if (next < 0) next = allImages.length - 1;
      while (next >= 0 && lockedImages.includes(allImages[next])) next--;
      return next;
    });
  }, [allImages, lockedImages]);

  const lightboxNext = useCallback(() => {
    setLightboxIndex((prev) => {
      let next = prev + 1;
      while (next < allImages.length && lockedImages.includes(allImages[next])) next++;
      if (next >= allImages.length) next = 0;
      while (next < allImages.length && lockedImages.includes(allImages[next])) next++;
      return next;
    });
  }, [allImages, lockedImages]);

  // Keyboard navigation for lightbox — attach to document so it works without
  // the dialog needing focus, and lock background scroll while it's open.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') lightboxPrev();
      else if (e.key === 'ArrowRight') lightboxNext();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen, closeLightbox, lightboxPrev, lightboxNext]);

  // Touch swipe for the lightbox (mobile left/right).
  const handleLightboxTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    lightboxTouchStart.current = { x: t.clientX, y: t.clientY };
    lightboxSwiped.current = false;
  }, []);

  const handleLightboxTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = lightboxTouchStart.current;
      lightboxTouchStart.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      // Only treat as a horizontal swipe (dominant axis + min distance).
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        lightboxSwiped.current = true;
        if (dx < 0) lightboxNext();
        else lightboxPrev();
      }
    },
    [lightboxNext, lightboxPrev]
  );

  // Backdrop click closes, but a swipe that may emit a trailing click must not.
  const handleLightboxBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (lightboxSwiped.current) {
        lightboxSwiped.current = false;
        return;
      }
      closeLightbox();
    },
    [closeLightbox]
  );

  return (
    <>
      {/* ========== Image Grid ========== */}
      <div className="mt-8">
        {/* ===== Unlock / Subscribe banner (top) ===== */}
        {/* Paid gallery (price > 0): non-members can buy it individually. */}
        {isGated && !isOwned && !membershipActive && isPaid && (
          <motion.div
            initial={
              shouldReduceMotion ? undefined : { opacity: 0, y: 12 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mb-8 p-6 rounded-2xl border border-[#ff2d78]/20 bg-[#ff2d78]/5 text-center"
          >
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-[#ff2d78]/15 border border-[#ff2d78]/30 mb-4">
              <LockIcon className="size-6 text-[#ff2d78]" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('unlock')}
            </h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
              {t('unlockPrice', {
                price: gallery.price,
                count: allImages.length,
              })}
            </p>
            <button
              type="button"
              onClick={handleUnlock}
              disabled={isUnlocking}
              className={cn(
                'inline-flex items-center gap-2 px-8 py-3.5 rounded-xl',
                'text-base font-semibold text-white',
                'bg-[#ff2d78] hover:bg-[#ff2d78]/90',
                'shadow-[0_0_30px_rgba(255,45,120,0.4)]',
                'hover:shadow-[0_0_40px_rgba(255,45,120,0.5)]',
                'transition-all duration-300',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2d78]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c28]',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                'active:scale-[0.98]'
              )}
              style={{ minHeight: 52 }}
            >
              {isUnlocking ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="size-4 border-2 border-white/30 border-t-white rounded-full"
                    aria-hidden="true"
                  />
                  Processing...
                </>
              ) : (
                <>
                  <UnlockIcon className="size-5" aria-hidden="true" />
                  {t('unlock')}
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Members-only (price == 0): non-members must subscribe — no individual purchase. */}
        {isGated && !isOwned && !membershipActive && !isPaid && (
          <motion.div
            initial={
              shouldReduceMotion ? undefined : { opacity: 0, y: 12 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mb-8 p-6 rounded-2xl border border-[#00d4ff]/20 bg-[#00d4ff]/5 text-center"
          >
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-[#00d4ff]/15 border border-[#00d4ff]/30 mb-4">
              <SparklesIcon className="size-6 text-[#00d4ff]" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('membersOnly')}
            </h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
              {t('membersOnlyDesc')}
            </p>
            <button
              type="button"
              onClick={() => router.push(`/${locale}/account`)}
              className={cn(
                'inline-flex items-center gap-2 px-8 py-3.5 rounded-xl',
                'text-base font-semibold text-white',
                'bg-[#00d4ff] hover:bg-[#00d4ff]/90',
                'shadow-[0_0_30px_rgba(0,212,255,0.4)]',
                'hover:shadow-[0_0_40px_rgba(0,212,255,0.5)]',
                'transition-all duration-300',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c28]',
                'active:scale-[0.98]'
              )}
              style={{ minHeight: 52 }}
            >
              <SparklesIcon className="size-5" aria-hidden="true" />
              {t('becomeMember')}
            </button>
          </motion.div>
        )}

        {isGated && canViewAll && hasExternal && (
          <motion.div
            initial={
              shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95 }
            }
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            {isOwned || localUnlock ? (
              <>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400">
                  <UnlockIcon className="size-4" aria-hidden="true" />
                  {t('alreadyUnlocked')}
                </span>
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                  style={{ minHeight: 44 }}
                >
                  {isDownloading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                      ...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <DownloadGlyph className="size-4" />
                      {downloadLabel}
                    </span>
                  )}
                </Button>
              </>
            ) : (
              // Member free-view but not yet owned: download consumes 1 quota
              // and permanently unlocks the gallery.
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="bg-[#ff2d78] hover:bg-[#ff2d78]/90 text-white font-semibold px-8"
                style={{
                  minHeight: 52,
                  boxShadow: '0 0 24px rgba(255,45,120,0.4)',
                }}
              >
                {isDownloading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <DownloadGlyph className="size-5" />
                    {downloadLabel}
                  </span>
                )}
              </Button>
            )}
          </motion.div>
        )}

        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-6 flex items-center gap-2.5">
          <SparklesIcon className="size-5 text-[#ff2d78]" aria-hidden="true" />
          {t('images')}
          <span className="text-sm font-normal text-muted-foreground">
            ({allImages.length})
          </span>
        </h2>

        {/* NSFW age gate banner */}
        {isNsfw && !nsfwRevealed && (
          <motion.div
            initial={
              shouldReduceMotion ? undefined : { opacity: 0, y: -8 }
            }
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl mb-6',
              'bg-violet-500/10 border border-violet-500/20'
            )}
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-violet-300 mb-1">
                {t('ageWarning')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleNsfwReveal}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl',
                'text-sm font-semibold text-white',
                'bg-violet-600 hover:bg-violet-500',
                'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
                'transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60'
              )}
              style={{ minHeight: 44 }}
            >
              <EyeIcon className="size-4" aria-hidden="true" />
              Reveal Content
            </button>
          </motion.div>
        )}

        {/* Image grid */}
        <div
          className={cn(
            'grid gap-3',
            'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
          )}
        >
          {allImages.map((image, index) => {
            const isLocked = lockedImages.includes(image);
            const isVisible = visibleImages.includes(image);

            return (
              <div
                key={image}
                className={cn(
                  'relative aspect-[3/4] rounded-xl overflow-hidden',
                  'bg-[#262633] border border-white/[0.06]',
                  'group'
                )}
              >
                {/* Image */}
                <div className={cn('relative w-full h-full', shouldBlur && 'blur-xl')}>
                  <Image
                    src={image}
                    alt={`Gallery image ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover"
                    unoptimized
                  />

                  {/* Locked overlay */}
                  {isLocked && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4"
                      style={{
                        background:
                          'linear-gradient(to top, rgba(20,20,31,0.95) 0%, rgba(20,20,31,0.7) 50%, rgba(20,20,31,0.4) 100%)',
                      }}
                    >
                      <div className="flex items-center justify-center size-12 rounded-full bg-[#ff2d78]/20 border border-[#ff2d78]/30">
                        <LockIcon className="size-5 text-[#ff2d78]" aria-hidden="true" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground text-center">
                        {t('preview')}
                      </span>
                    </div>
                  )}

                  {/* Visible image — click to open lightbox */}
                  {isVisible && !shouldBlur && (
                    <button
                      type="button"
                      onClick={() => openLightbox(index)}
                      className={cn(
                        'absolute inset-0 opacity-0 group-hover:opacity-100',
                        'bg-black/30 transition-opacity duration-200',
                        'flex items-center justify-center',
                        'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/60 focus-visible:ring-inset'
                      )}
                      aria-label={`View image ${index + 1}`}
                    >
                      <EyeIcon className="size-6 text-white" aria-hidden="true" />
                    </button>
                  )}

                  {/* NSFW blur overlay with reveal button */}
                  {shouldBlur && isVisible && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
                      <EyeOffIcon className="size-8 text-white/60" aria-hidden="true" />
                      <button
                        type="button"
                        onClick={handleNsfwReveal}
                        className={cn(
                          'px-4 py-2 rounded-lg text-xs font-semibold',
                          'bg-violet-600/90 hover:bg-violet-500 text-white',
                          'transition-colors duration-200'
                        )}
                        style={{ minHeight: 44 }}
                      >
                        Click to Reveal
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>


      </div>

      {/* ========== Age Gate Modal ========== */}
      <AnimatePresence>
        {showAgeGate && (
          <motion.div
            initial={
              shouldReduceMotion ? undefined : { opacity: 0 }
            }
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAgeGate(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Age verification"
          >
            <motion.div
              initial={
                shouldReduceMotion
                  ? undefined
                  : { opacity: 0, scale: 0.95, y: 12 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                shouldReduceMotion
                  ? undefined
                  : { opacity: 0, scale: 0.95, y: 12 }
              }
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full max-w-md rounded-2xl',
                'border border-violet-500/20',
                'bg-[#262633]/95 backdrop-blur-xl',
                'p-6 sm:p-8',
                'shadow-2xl shadow-violet-950/30'
              )}
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center size-16 rounded-full bg-violet-600/20 border border-violet-500/30 mb-5">
                  <EyeOffIcon className="size-7 text-violet-400" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Age Verification
                </h3>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  {t('ageWarning')}
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => setShowAgeGate(false)}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-xl',
                      'text-sm font-medium text-muted-foreground',
                      'border border-white/[0.08]',
                      'hover:border-white/[0.2] hover:text-foreground',
                      'transition-all duration-200'
                    )}
                    style={{ minHeight: 44 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAgeConfirm}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-xl',
                      'text-sm font-semibold text-white',
                      'bg-violet-600 hover:bg-violet-500',
                      'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
                      'transition-all duration-200'
                    )}
                    style={{ minHeight: 44 }}
                  >
                    I am 18+
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== Lightbox ========== */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={
              shouldReduceMotion ? undefined : { opacity: 0 }
            }
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md"
            onClick={handleLightboxBackdropClick}
            onTouchStart={handleLightboxTouchStart}
            onTouchEnd={handleLightboxTouchEnd}
            role="dialog"
            aria-modal="true"
            aria-label="Image viewer"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closeLightbox}
              className={cn(
                'absolute top-4 right-4 z-10',
                'flex items-center justify-center size-12 rounded-xl',
                'text-white/70 hover:text-white',
                'bg-white/[0.06] hover:bg-white/[0.12]',
                'transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40'
              )}
              aria-label="Close image viewer"
            >
              <XIcon className="size-5" />
            </button>

            {/* Previous */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                lightboxPrev();
              }}
              className={cn(
                'absolute left-4 z-10',
                'flex items-center justify-center size-12 rounded-xl',
                'text-white/70 hover:text-white',
                'bg-white/[0.06] hover:bg-white/[0.12]',
                'transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40'
              )}
              aria-label="Previous image"
            >
              <ChevronLeftIcon className="size-6" />
            </button>

            {/* Image */}
            <motion.div
              key={lightboxIndex}
              initial={
                shouldReduceMotion
                  ? undefined
                  : { opacity: 0, scale: 0.95 }
              }
              animate={{ opacity: 1, scale: 1 }}
              exit={
                shouldReduceMotion
                  ? undefined
                  : { opacity: 0, scale: 0.95 }
              }
              transition={{ duration: 0.2 }}
              className="relative w-full h-full max-w-5xl max-h-[90vh] m-8"
              style={{ touchAction: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={allImages[lightboxIndex]}
                alt={`Gallery image ${lightboxIndex + 1}`}
                fill
                className="object-contain"
                unoptimized
              />
            </motion.div>

            {/* Next */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                lightboxNext();
              }}
              className={cn(
                'absolute right-4 z-10',
                'flex items-center justify-center size-12 rounded-xl',
                'text-white/70 hover:text-white',
                'bg-white/[0.06] hover:bg-white/[0.12]',
                'transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40'
              )}
              aria-label="Next image"
            >
              <ChevronRightIcon className="size-6" />
            </button>

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <span className="text-sm text-white/50 font-medium tabular-nums">
                {lightboxIndex + 1} / {allImages.length}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
