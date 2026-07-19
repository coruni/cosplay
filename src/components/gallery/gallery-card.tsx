'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import { EyeIcon, LockIcon, StarIcon, UserIcon } from 'lucide-react';
import { getRatingLabel, getRatingColor } from '@/lib/content-filter';
import { cn } from '@/lib/utils';
import type { Gallery } from '@/types';

interface GalleryCardProps {
  gallery: Gallery;
  index?: number;
  priority?: boolean;
}

/**
 * GalleryCard — glassmorphism card with neon hover glow.
 *
 * Key design choices:
 * - Glassmorphism bg with subtle border, transitions to neon pink border on hover
 * - Cover image with Next/Image (unoptimized for placeholder images)
 * - Rating badge (SFW emerald / NSFW violet)
 * - Price pill: "Free" in emerald glow or price in neon pink
 * - View count with electric blue icon
 * - Framer Motion scale on hover (1.02) with glow border
 * - Respects prefers-reduced-motion
 * - NSFW filtering is handled server-side (DB layer) via cookie, not here
 * - All touch targets ≥ 44×44px
 */
export function GalleryCard({ gallery, index = 0, priority = false }: GalleryCardProps) {
  const t = useTranslations('gallery');
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();

  const title = gallery.title[locale as keyof typeof gallery.title] ?? gallery.title.en;
  const isFree = !gallery.isPremium || gallery.price === 0;
  const ratingLabel = getRatingLabel(gallery.rating, locale);
  const ratingColorClasses = getRatingColor(gallery.rating);

  const handleClick = useCallback(() => {
    window.location.href = `/${locale}/gallery/${gallery.slug}`;
  }, [gallery.slug, locale]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  // NOTE: NSFW filtering now happens at the database layer (server reads the
  // cookie and only fetches SFW rows unless opted in). This card renders
  // whatever it receives — no client-side rating gate needed.

  return (
    <motion.article
      initial={
        shouldReduceMotion
          ? undefined
          : { opacity: 0, y: 24 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : {
              duration: 0.45,
              delay: index * 0.08,
              ease: [0.25, 0.46, 0.45, 0.94],
            }
      }
      whileHover={
        shouldReduceMotion
          ? undefined
          : { scale: 1.02 }
      }
      className={cn(
        'group relative cursor-pointer rounded-xl overflow-hidden',
        'bg-[#14141f]/70 backdrop-blur-sm',
        'border border-white/[0.06]',
        'transition-all duration-300',
        'hover:border-[#ff2d78]/40',
        'hover:shadow-[0_0_30px_rgba(255,45,120,0.15),0_0_60px_rgba(255,45,120,0.05)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2d78]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`${title} — ${gallery.cosplayer}`}
      style={{ minHeight: 320 }}
    >
      {/* Cover Image */}
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <Image
          src={gallery.cover}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          unoptimized
          priority={priority}
        />

        {/* Gradient overlay — bottom fade */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(20,20,31,0.95) 0%, rgba(20,20,31,0.5) 40%, transparent 100%)',
          }}
        />

        {/* Rating badge — top left */}
        <span
          className={cn(
            'absolute top-3 left-3 inline-flex items-center gap-1',
            'px-2 py-1 rounded-md text-xs font-semibold',
            'border backdrop-blur-md',
            ratingColorClasses
          )}
        >
          {gallery.rating === 'nsfw' && (
            <StarIcon className="size-2.5" aria-hidden="true" />
          )}
          {ratingLabel}
        </span>

        {/* Price badge — top right */}
        <span
          className={cn(
            'absolute top-3 right-3 inline-flex items-center gap-1',
            'px-2.5 py-1 rounded-md text-xs font-bold',
            'border backdrop-blur-md',
            isFree
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
              : 'bg-[#ff2d78]/20 text-[#ff2d78] border-[#ff2d78]/30 shadow-[0_0_10px_rgba(255,45,120,0.2)]'
          )}
        >
          {isFree ? (
            t('free')
          ) : (
            <>
              {gallery.isPremium && (
                <LockIcon className="size-2.5" aria-hidden="true" />
              )}
              ¥{gallery.price}
            </>
          )}
        </span>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-2.5">
        {/* Title */}
        <h3 className="text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-[#ff2d78] transition-colors duration-200">
          {title}
        </h3>

        {/* Cosplayer & Character */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <UserIcon className="size-3.5 text-[#00d4ff]" aria-hidden="true" />
            <span className="truncate max-w-[120px]">{gallery.cosplayer}</span>
          </span>
          <span className="text-white/15" aria-hidden="true">·</span>
          <span className="truncate max-w-[140px]">
            {gallery.character}
            {gallery.series && (
              <span className="text-muted-foreground/50">
                {' '}· {gallery.series}
              </span>
            )}
          </span>
        </div>

        {/* Footer: view count + image count */}
        <div className="flex items-center justify-between pt-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <EyeIcon className="size-3.5" aria-hidden="true" />
            {t('views', { count: gallery.viewCount })}
          </span>
          <span className="text-xs text-muted-foreground/50">
            {t('images', { count: gallery.images.length })}
          </span>
        </div>
      </div>

      {/* Neon border glow on hover — pseudo element via absolute overlay */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          boxShadow:
            'inset 0 0 0 1px rgba(255,45,120,0.3), 0 0 20px rgba(255,45,120,0.1)',
        }}
      />
    </motion.article>
  );
}
