'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GalleryPaginationProps {
  currentPage: number;
  totalPages: number;
}

/**
 * GalleryPagination — page navigation for gallery listing.
 *
 * Features:
 * - Previous / Next buttons with icons
 * - Page number buttons with active state (neon pink)
 * - Smart ellipsis for large page counts
 * - Uses router.push with scroll: false for smooth UX
 * - All touch targets ≥ 44×44px
 */
export function GalleryPagination({
  currentPage,
  totalPages,
}: GalleryPaginationProps) {
  const router = useRouter();
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(window.location.search);
      if (page === 1) {
        params.delete('page');
      } else {
        params.set('page', String(page));
      }
      const queryString = params.toString();
      const basePath = `/${locale}/gallery`;
      router.push(queryString ? `${basePath}?${queryString}` : basePath, {
        scroll: false,
      });
    },
    [locale, router]
  );

  // Generate page numbers with ellipsis
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis');
    }

    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <motion.nav
      initial={
        shouldReduceMotion ? undefined : { opacity: 0, y: 12 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
      className="flex items-center justify-center gap-1.5 mt-12"
      aria-label="Gallery pagination"
    >
      {/* Previous */}
      <button
        type="button"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className={cn(
          'flex items-center justify-center size-11 rounded-xl',
          'border border-white/[0.08]',
          'text-muted-foreground',
          'transition-all duration-200',
          'hover:border-white/[0.2] hover:text-foreground hover:bg-white/[0.04]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/40',
          'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-white/[0.08]'
        )}
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="size-5" aria-hidden="true" />
      </button>

      {/* Page numbers */}
      {pageNumbers.map((page, idx) =>
        page === 'ellipsis' ? (
          <span
            key={`ellipsis-${idx}`}
            className="flex items-center justify-center size-11 text-muted-foreground/50 select-none"
            aria-hidden="true"
          >
            ···
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => goToPage(page)}
            className={cn(
              'flex items-center justify-center size-11 rounded-xl text-sm font-medium',
              'transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/40',
              page === currentPage
                ? 'bg-[#ff2d78]/15 text-[#ff2d78] border border-[#ff2d78]/30 shadow-[0_0_12px_rgba(255,45,120,0.15)]'
                : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.04] hover:border-white/[0.1]'
            )}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        type="button"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={cn(
          'flex items-center justify-center size-11 rounded-xl',
          'border border-white/[0.08]',
          'text-muted-foreground',
          'transition-all duration-200',
          'hover:border-white/[0.2] hover:text-foreground hover:bg-white/[0.04]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/40',
          'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-white/[0.08]'
        )}
        aria-label="Next page"
      >
        <ChevronRightIcon className="size-5" aria-hidden="true" />
      </button>
    </motion.nav>
  );
}
