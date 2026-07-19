'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useTranslations, useLocale } from 'next-intl';
import { ChevronDownIcon, SparklesIcon, ArrowRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  categories: string[];
}

/**
 * HeroSection — full-viewport hero with animated gradient mesh background.
 *
 * Memory point: The animated gradient mesh with noise texture creates an immersive
 * cyberpunk atmosphere that feels alive. Two large blobs (neon pink and electric blue)
 * drift slowly in the background, overlaid with a fine noise/grain texture.
 *
 * Features:
 * - Full viewport height (100dvh)
 * - CSS-only animated gradient mesh (no canvas needed for performance)
 * - Noise texture overlay via SVG filter
 * - Staggered entrance animations for text and CTAs
 * - Two CTA buttons: primary (neon pink bg) and secondary (electric blue outline)
 * - Scroll-down chevron indicator with bounce animation
 * - Respects prefers-reduced-motion
 * - All touch targets ≥ 44×44px
 */
export function HeroSection({ categories }: HeroSectionProps) {
  const t = useTranslations('hero');
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();

  const handleExploreClick = useCallback(() => {
    window.location.href = `/${locale}/gallery`;
  }, [locale]);

  const handleCategoriesClick = useCallback(() => {
    window.location.href = `/${locale}/categories`;
  }, [locale]);

  const handleScrollDown = useCallback(() => {
    const featuredSection = document.getElementById('featured-galleries');
    if (featuredSection) {
      featuredSection.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    } else {
      window.scrollBy({ top: window.innerHeight, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    }
  }, [shouldReduceMotion]);

  return (
    <section
      className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden"
      aria-label="Hero"
    >
      {/* ========== Animated Gradient Mesh Background ========== */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        {/* Deep space base */}
        <div className="absolute inset-0 bg-[#1c1c28]" />

        {/* Gradient mesh blobs */}
        <div
          className={cn(
            'absolute -top-1/4 -left-1/4 w-[80%] h-[80%] rounded-full blur-[120px]',
            !shouldReduceMotion && 'animate-[hero-blob-1_18s_ease-in-out_infinite]'
          )}
          style={{
            background:
              'radial-gradient(circle, rgba(255,45,120,0.18) 0%, rgba(255,45,120,0.06) 35%, transparent 70%)',
          }}
        />
        <div
          className={cn(
            'absolute -bottom-1/4 -right-1/4 w-[80%] h-[80%] rounded-full blur-[120px]',
            !shouldReduceMotion && 'animate-[hero-blob-2_22s_ease-in-out_infinite]'
          )}
          style={{
            background:
              'radial-gradient(circle, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.05) 35%, transparent 70%)',
          }}
        />
        <div
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full blur-[150px]',
            !shouldReduceMotion && 'animate-[hero-blob-3_20s_ease-in-out_infinite]'
          )}
          style={{
            background:
              'radial-gradient(circle, rgba(168,85,247,0.1) 0%, rgba(168,85,247,0.03) 40%, transparent 70%)',
          }}
        />

        {/* Subtle grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        {/* Noise/grain texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '256px 256px',
          }}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 50%, rgba(10,10,15,0.8) 100%)',
          }}
        />
      </div>

      {/* ========== Content ========== */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto pt-20 pb-16">
        {/* Small badge / eyebrow */}
        <motion.div
          initial={
            shouldReduceMotion ? undefined : { opacity: 0, y: 12 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.5, delay: 0.1, ease: 'easeOut' }
          }
          className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-[#ff2d78]/20 bg-[#ff2d78]/5 text-[#ff2d78] text-sm font-medium"
        >
          <SparklesIcon className="size-3.5" aria-hidden="true" />
          <span>Premium Cosplay Collections</span>
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={
            shouldReduceMotion ? undefined : { opacity: 0, y: 20 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }
          }
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6 max-w-4xl"
        >
          <span className="text-foreground">{t('title')}</span>
          <br />
          <span
            className="text-transparent bg-clip-text"
            style={{
              backgroundImage:
                'linear-gradient(135deg, #ff2d78 0%, #ff6b9d 40%, #ff2d78 70%, #ff8fab 100%)',
              backgroundSize: '200% 200%',
              filter:
                'drop-shadow(0 0 20px rgba(255,45,120,0.5)) drop-shadow(0 0 40px rgba(255,45,120,0.2))',
            }}
          >
            {t('titleHighlight')}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={
            shouldReduceMotion ? undefined : { opacity: 0, y: 16 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.5, delay: 0.4, ease: 'easeOut' }
          }
          className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed"
        >
          {t('subtitle')}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={
            shouldReduceMotion ? undefined : { opacity: 0, y: 16 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.5, delay: 0.55, ease: 'easeOut' }
          }
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          {/* Primary CTA — neon pink bg */}
          <button
            type="button"
            onClick={handleExploreClick}
            className={cn(
              'group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl',
              'text-base font-semibold text-white',
              'bg-[#ff2d78] hover:bg-[#ff2d78]/90',
              'shadow-[0_0_30px_rgba(255,45,120,0.4),0_0_60px_rgba(255,45,120,0.15)]',
              'hover:shadow-[0_0_40px_rgba(255,45,120,0.5),0_0_80px_rgba(255,45,120,0.2)]',
              'transition-all duration-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2d78]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c28]',
              'active:scale-[0.98]'
            )}
            style={{ minHeight: 52, minWidth: 44 }}
          >
            {t('cta')}
            <ArrowRightIcon
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </button>

          {/* Secondary CTA — electric blue outline */}
          <button
            type="button"
            onClick={handleCategoriesClick}
            className={cn(
              'group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl',
              'text-base font-semibold text-[#00d4ff]',
              'border border-[#00d4ff]/30',
              'bg-transparent hover:bg-[#00d4ff]/5',
              'hover:border-[#00d4ff]/50',
              'hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]',
              'transition-all duration-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c28]',
              'active:scale-[0.98]'
            )}
            style={{ minHeight: 52, minWidth: 44 }}
          >
            {t('ctaSecondary')}
          </button>
        </motion.div>
      </div>

      {/* ========== Scroll Down Indicator ========== */}
      <motion.button
        type="button"
        onClick={handleScrollDown}
        initial={
          shouldReduceMotion ? undefined : { opacity: 0 }
        }
        animate={{ opacity: 1 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 0.6, delay: 1.0 }
        }
        className={cn(
          'absolute bottom-8 left-1/2 -translate-x-1/2 z-10',
          'flex flex-col items-center gap-2',
          'text-muted-foreground/50 hover:text-[#ff2d78]',
          'transition-colors duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg'
        )}
        style={{ minHeight: 44, minWidth: 44 }}
        aria-label="Scroll to featured galleries"
      >
        <span className="text-xs font-medium tracking-widest uppercase">
          Explore
        </span>
        <motion.span
          animate={
            shouldReduceMotion
              ? undefined
              : { y: [0, 8, 0] }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <ChevronDownIcon className="size-5" aria-hidden="true" />
        </motion.span>
      </motion.button>
    </section>
  );
}
