'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowRightIcon, SparklesIcon } from 'lucide-react';
import { GalleryGrid } from '@/components/gallery/gallery-grid';
import { cn } from '@/lib/utils';
import type { Gallery } from '@/types';

interface FeaturedSectionProps {
  galleries: Gallery[];
}

/**
 * FeaturedSection — showcases top 6 galleries below the hero.
 *
 * Design:
 * - Section header with "Featured Galleries" title and a "View All" link
 * - Uses GalleryGrid for responsive layout
 * - Fade-in on scroll (via Framer Motion whileInView)
 * - Subtle top border gradient separating from hero
 */
export function FeaturedSection({ galleries }: FeaturedSectionProps) {
  const t = useTranslations('gallery');
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();

  const viewAllHref = `/${locale}/gallery`;

  return (
    <section
      id="featured-galleries"
      className="relative py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8"
    >
      {/* Top separator — subtle gradient line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-[#ff2d78]/30 to-transparent" />

      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={
            shouldReduceMotion ? undefined : { opacity: 0, y: 24 }
          }
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
          }
          className="flex items-end justify-between mb-10 sm:mb-14"
        >
          <div>
            <div className="inline-flex items-center gap-2 mb-3">
              <SparklesIcon
                className="size-4 text-[#ff2d78]"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold tracking-widest uppercase text-[#ff2d78]/70">
                Featured
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
              {t('title')}
            </h2>
          </div>

          {/* View All link */}
          <a
            href={viewAllHref}
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5',
              'text-sm font-medium text-[#00d4ff]',
              'hover:text-[#00d4ff]/80 hover:gap-2.5',
              'transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/40 rounded-lg px-2 py-1'
            )}
            style={{ minHeight: 44 }}
          >
            View All
            <ArrowRightIcon className="size-4 transition-transform duration-200" aria-hidden="true" />
          </a>
        </motion.div>

        {/* Gallery grid */}
        <GalleryGrid galleries={galleries} />

        {/* Mobile "View All" link */}
        <motion.div
          initial={
            shouldReduceMotion ? undefined : { opacity: 0 }
          }
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-10 text-center sm:hidden"
        >
          <a
            href={viewAllHref}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-3 rounded-xl',
              'text-sm font-semibold text-[#00d4ff]',
              'border border-[#00d4ff]/20',
              'hover:bg-[#00d4ff]/5 hover:border-[#00d4ff]/40',
              'transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/40'
            )}
            style={{ minHeight: 44 }}
          >
            {t('viewDetails')}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
