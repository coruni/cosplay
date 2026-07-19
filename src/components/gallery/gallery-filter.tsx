'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import {
  SearchIcon,
  XIcon,
  FilterIcon,
  ArrowUpDownIcon,
  CheckIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { localizedCategoryName } from '@/lib/category-name';
import type { SortOption, CategoryOption } from '@/types';

interface GalleryFilterProps {
  categories: CategoryOption[];
  currentCategory?: string;
  currentSort?: SortOption;
  currentQuery?: string;
}

/**
 * GalleryFilter — search bar, category chips, and sort dropdown.
 *
 * Features:
 * - Debounced search input with clear button
 * - Horizontal scrollable category chips with active state
 * - Sort dropdown (newest / popular / price-low)
 * - All interactive elements have 44×44px minimum touch targets
 * - Cyberpunk-styled: electric blue focus rings, glassmorphism backgrounds
 * - Uses URL search params for state (no client-side state management needed)
 */
export function GalleryFilter({
  categories,
  currentCategory,
  currentSort = 'newest',
  currentQuery = '',
}: GalleryFilterProps) {
  const t = useTranslations('gallery');
  const locale = useLocale();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const [searchValue, setSearchValue] = useState(currentQuery);
  const [sortOpen, setSortOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Sync search value with URL query changes
  useEffect(() => {
    setSearchValue(currentQuery);
  }, [currentQuery]);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(e.target as Node)
      ) {
        setSortOpen(false);
      }
    };
    if (sortOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [sortOpen]);

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(window.location.search);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '' || value === 'all') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      // Reset page when filters change
      if (!('page' in updates)) {
        params.delete('page');
      }

      const queryString = params.toString();
      const basePath = `/${locale}/gallery`;
      router.push(queryString ? `${basePath}?${queryString}` : basePath, {
        scroll: false,
      });
    },
    [locale, router]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        updateParams({ query: value || undefined });
      }, 350);
    },
    [updateParams]
  );

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateParams({ query: undefined });
  }, [updateParams]);

  const handleCategoryClick = useCallback(
    (category: string) => {
      const newCategory =
        category === currentCategory || category === 'all' ? undefined : category;
      updateParams({ category: newCategory });
    },
    [currentCategory, updateParams]
  );

  const handleSortChange = useCallback(
    (sort: SortOption) => {
      setSortOpen(false);
      updateParams({ sort: sort === 'newest' ? undefined : sort });
    },
    [updateParams]
  );

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: t('sortNewest') },
    { value: 'popular', label: t('sortPopular') },
    { value: 'price-low', label: t('sortPriceLow') },
  ];

  const currentSortLabel =
    sortOptions.find((o) => o.value === currentSort)?.label ?? t('sortNewest');

  return (
    <motion.div
      initial={
        shouldReduceMotion ? undefined : { opacity: 0, y: -8 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-4"
    >
      {/* Search bar + Sort row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <SearchIcon
            className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground/60 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('search')}
            className={cn(
              'w-full h-11 rounded-xl pl-11 pr-10',
              'bg-[#262633]/80 backdrop-blur-sm',
              'border border-white/[0.08]',
              'text-base text-foreground placeholder:text-muted-foreground/50',
              'focus:outline-none focus:border-[#00d4ff]/40 focus:ring-2 focus:ring-[#00d4ff]/10',
              'transition-all duration-200'
            )}
            aria-label={t('search')}
          />
          {searchValue && (
            <button
              type="button"
              onClick={handleClearSearch}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2',
                'flex items-center justify-center size-8 rounded-lg',
                'text-muted-foreground hover:text-foreground',
                'hover:bg-white/[0.06] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
              aria-label="Clear search"
              style={{ minHeight: 44, minWidth: 44 }}
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative" ref={sortDropdownRef}>
          <button
            type="button"
            onClick={() => setSortOpen(!sortOpen)}
            className={cn(
              'flex items-center gap-2 h-11 px-4 rounded-xl',
              'bg-[#262633]/80 backdrop-blur-sm',
              'border border-white/[0.08]',
              'text-sm text-muted-foreground',
              'hover:text-foreground hover:border-white/[0.15]',
              'transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/40',
              sortOpen && 'border-[#00d4ff]/30 text-foreground'
            )}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            aria-label={t('sortBy')}
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <ArrowUpDownIcon className="size-4 text-[#00d4ff]" aria-hidden="true" />
            <span className="hidden sm:inline">{currentSortLabel}</span>
          </button>

          {/* Dropdown menu */}
          {sortOpen && (
            <motion.div
              initial={
                shouldReduceMotion
                  ? undefined
                  : { opacity: 0, y: -4, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={cn(
                'absolute right-0 top-full mt-1.5 z-20 w-44',
                'rounded-xl border border-white/[0.08]',
                'bg-[#262633]/95 backdrop-blur-xl',
                'shadow-lg shadow-black/40',
                'py-1.5 overflow-hidden'
              )}
              role="listbox"
              aria-label={t('sortBy')}
            >
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  role="option"
                  aria-selected={currentSort === option.value}
                  onClick={() => handleSortChange(option.value)}
                  className={cn(
                    'flex items-center justify-between w-full px-4 py-2.5 text-sm',
                    'transition-colors duration-100',
                    currentSort === option.value
                      ? 'text-[#00d4ff] bg-[#00d4ff]/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                  )}
                  style={{ minHeight: 44 }}
                >
                  <span>{option.label}</span>
                  {currentSort === option.value && (
                    <CheckIcon className="size-4" aria-hidden="true" />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        <button
          type="button"
          onClick={() => handleCategoryClick('all')}
          className={cn(
            'shrink-0 inline-flex items-center px-3.5 py-2 rounded-full text-sm font-medium',
            'border transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/40',
            !currentCategory || currentCategory === 'all'
              ? 'bg-[#ff2d78]/15 text-[#ff2d78] border-[#ff2d78]/30 shadow-[0_0_12px_rgba(255,45,120,0.15)]'
              : 'bg-transparent text-muted-foreground border-white/[0.08] hover:border-white/[0.2] hover:text-foreground'
          )}
          style={{ minHeight: 36 }}
        >
          <FilterIcon className="size-3.5 mr-1.5" aria-hidden="true" />
          {t('allCategories')}
        </button>

        {categories.map((cat) => (
          <button
            key={cat.slug}
            type="button"
            onClick={() => handleCategoryClick(cat.slug)}
            className={cn(
              'shrink-0 inline-flex items-center px-3.5 py-2 rounded-full text-sm font-medium',
              'border transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/40',
              currentCategory === cat.slug
                ? 'bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]/30 shadow-[0_0_12px_rgba(0,212,255,0.15)]'
                : 'bg-transparent text-muted-foreground border-white/[0.08] hover:border-white/[0.2] hover:text-foreground'
            )}
            style={{ minHeight: 36 }}
          >
            {localizedCategoryName(cat.name, locale, cat.slug)}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
