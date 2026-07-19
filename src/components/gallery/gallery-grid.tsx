'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useTranslations } from 'next-intl';
import { SearchXIcon, EyeOffIcon } from 'lucide-react';
import { GalleryCard } from '@/components/gallery/gallery-card';
import type { Gallery } from '@/types';

interface GalleryGridProps {
  galleries: Gallery[];
  /** Total count (server already applied the NSFW rating filter) */
  totalCount?: number;
  /**
   * Whether NSFW is currently shown (from the server cookie). Used only to pick
   * the empty-state copy — the actual filtering happens in the DB layer.
   * Defaults to true so featured/related grids just show a neutral empty state.
   */
  showNsfw?: boolean;
}

/**
 * GalleryGrid — responsive gallery layout with staggered entrance animations.
 *
 * Layout:
 * - 2 cols on mobile (default)
 * - 3 cols at sm (640px)
 * - 3 cols at lg (1024px)
 * - 4 cols at xl (1280px)
 *
 * Each GalleryCard fades in with staggered delay.
 * Handles three empty states:
 * 1. No galleries at all (search returned nothing)
 * 2. All galleries filtered out by NSFW toggle
 * 3. Empty array passed in
 */
export function GalleryGrid({
  galleries,
  totalCount,
  showNsfw = true,
}: GalleryGridProps) {
  const t = useTranslations('gallery');
  const shouldReduceMotion = useReducedMotion();

  // Empty AND user has NSFW hidden → some rows may exist behind the toggle.
  const emptyDueToNsfwHidden = galleries.length === 0 && !showNsfw;

  // Empty state — differentiate "hidden NSFW" from "genuinely no results".
  if (galleries.length === 0) {
    if (emptyDueToNsfwHidden) {
      return (
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center justify-center py-24 px-4 text-center"
        >
          <div className="relative mb-6">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-20"
              style={{
                background:
                  'radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)',
              }}
            />
            <EyeOffIcon
              className="relative size-16 text-[#a855f7]/50"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t('nsfwHiddenTitle')}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {t('nsfwHiddenDesc')}
          </p>
        </motion.div>
      );
    }
    return (
      <motion.div
        initial={
          shouldReduceMotion ? undefined : { opacity: 0, y: 16 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col items-center justify-center py-24 px-4 text-center"
      >
        <div className="relative mb-6">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-20"
            style={{
              background:
                'radial-gradient(circle, rgba(0,212,255,0.4) 0%, transparent 70%)',
            }}
          />
          <SearchXIcon
            className="relative size-16 text-[#00d4ff]/50"
            aria-hidden="true"
          />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t('noResults')}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('search')}
        </p>
      </motion.div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-5',
        'grid-cols-2',
        'sm:grid-cols-3',
        'lg:grid-cols-3',
        'xl:grid-cols-4'
      )}
    >
      {galleries.map((gallery, index) => (
        <GalleryCard
          key={gallery.id}
          gallery={gallery}
          index={index}
          priority={index < 4}
        />
      ))}
    </div>
  );
}

// Inline cn to avoid circular dependency — GalleryGrid is self-contained
function cn(...inputs: (string | undefined | false | null)[]) {
  return inputs.filter(Boolean).join(' ');
}
