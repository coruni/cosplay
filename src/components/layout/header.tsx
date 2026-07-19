'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useTranslations, useLocale } from 'next-intl';
import {
  SearchIcon,
  XIcon,
  MenuIcon,
  GlobeIcon,
  ChevronDownIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NsfwToggle } from '@/components/layout/nsfw-toggle';
import { MobileNav } from '@/components/layout/mobile-nav';
import { UserMenu } from '@/components/layout/user-menu';
import { cn } from '@/lib/utils';

interface LocaleOption {
  code: string;
  label: string;
  flag: string;
}

const localeOptions: LocaleOption[] = [
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
];

interface NavLink {
  href: string;
  labelKey: 'nav.home' | 'nav.gallery' | 'nav.categories';
}

const desktopNavLinks: NavLink[] = [
  { href: '/', labelKey: 'nav.home' },
  { href: '/gallery', labelKey: 'nav.gallery' },
  { href: '/categories', labelKey: 'nav.categories' },
];

/**
 * Main site header — sticky, glassmorphism, cyberpunk-styled.
 *
 * Features:
 * - "CosHub" logo with neon pink gradient and glow effect (Orbitron font)
 * - Desktop navigation links with electric blue hover underline
 * - Expandable search bar (click to expand on desktop)
 * - NSFW toggle with violet glow when active
 * - Language switcher dropdown with flag emoji indicators
 * - Mobile hamburger → opens MobileNav sheet
 * - Sticky with backdrop-blur on scroll (glassmorphism)
 * - Framer Motion slide-down entrance animation
 * - All touch targets ≥ 44×44px
 */
export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();

  // State
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Track scroll for glassmorphism effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll(); // Check initial state
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Focus search input when expanded
  useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchExpanded]);

  // Close search on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchExpanded) {
        setSearchExpanded(false);
        setSearchValue('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchExpanded]);

  // Close search on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchExpanded &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchExpanded(false);
        setSearchValue('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchExpanded]);

  // Close language dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        langDropdownOpen &&
        langDropdownRef.current &&
        !langDropdownRef.current.contains(e.target as Node)
      ) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [langDropdownOpen]);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchValue.trim()) {
        window.location.href = `/${locale}/gallery?query=${encodeURIComponent(searchValue.trim())}`;
      }
      setSearchExpanded(false);
      setSearchValue('');
    },
    [searchValue, locale]
  );

  const handleLocaleChange = useCallback(
    (newLocale: string) => {
      const currentPath = window.location.pathname;
      const pathWithoutLocale = currentPath.replace(
        /^\/(zh|en|ja)(\/|$)/,
        '/'
      );
      const newPath = `/${newLocale}${pathWithoutLocale}`;
      window.location.href = newPath;
      setLangDropdownOpen(false);
    },
    []
  );

  const currentLocaleOption = localeOptions.find(
    (opt) => opt.code === locale
  ) ?? localeOptions[0];

  // Build localized href — always prefix locale
  const localizedHref = useCallback(
    (href: string) => {
      return `/${locale}${href === '/' ? '' : href}`;
    },
    [locale]
  );

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
        }
        className={cn(
          'sticky top-0 z-40 w-full',
          'transition-all duration-300',
          scrolled
            ? 'bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.03),0_8px_32px_rgba(0,0,0,0.4)]'
            : 'bg-transparent'
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <a
            href={localizedHref('/')}
            className="flex shrink-0 items-center gap-2 mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
            aria-label="CosHub — Home"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <span
              className="text-xl sm:text-2xl font-bold tracking-[0.15em] text-transparent bg-clip-text select-none"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #ff2d78 0%, #ff6b9d 50%, #ff2d78 100%)',
                filter:
                  'drop-shadow(0 0 10px rgba(255,45,120,0.6)) drop-shadow(0 0 20px rgba(255,45,120,0.3))',
                fontFamily: 'Orbitron, sans-serif',
              }}
            >
              CosHub
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav
            className="hidden md:flex items-center gap-1"
            aria-label="Main navigation"
          >
            {desktopNavLinks.map((link) => (
              <a
                key={link.labelKey}
                href={localizedHref(link.href)}
                className={cn(
                  'relative px-3 py-2 rounded-lg text-sm font-medium',
                  'text-foreground/70 hover:text-foreground',
                  'hover:bg-white/[0.04]',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'group'
                )}
                style={{ minHeight: 44 }}
              >
                {t(link.labelKey)}
                <span
                  className="absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full transition-all duration-200 group-hover:w-3/4"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, #00d4ff, transparent)',
                  }}
                />
              </a>
            ))}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Desktop: Search bar */}
          <div ref={searchContainerRef} className="hidden sm:flex items-center">
            <AnimatePresence mode="wait">
              {searchExpanded ? (
                <motion.form
                  key="search-expanded"
                  initial={{ width: 32, opacity: 0 }}
                  animate={{ width: 220, opacity: 1 }}
                  exit={{ width: 32, opacity: 0 }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.2,
                    ease: 'easeOut',
                  }}
                  onSubmit={handleSearchSubmit}
                  className="flex items-center"
                >
                  <div className="relative flex items-center">
                    <SearchIcon className="absolute left-2.5 size-4 text-muted-foreground pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder={t('nav.search')}
                      className={cn(
                        'h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04]',
                        'pl-8 pr-8 text-sm text-foreground',
                        'placeholder:text-muted-foreground/60',
                        'focus:outline-none focus:border-[#00d4ff]/40 focus:ring-2 focus:ring-[#00d4ff]/10',
                        'transition-all duration-200'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSearchExpanded(false);
                        setSearchValue('');
                      }}
                      className="absolute right-1 size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
                      aria-label="Close search"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.button
                  key="search-icon"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.2,
                    ease: 'easeOut',
                  }}
                  onClick={() => setSearchExpanded(true)}
                  className={cn(
                    'flex items-center justify-center size-11 rounded-lg',
                    'text-muted-foreground hover:text-foreground',
                    'hover:bg-white/[0.04]',
                    'transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                  aria-label={t('nav.search')}
                >
                  <SearchIcon className="size-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop: NSFW Toggle */}
          <div className="hidden md:flex items-center">
            <NsfwToggle size="sm" showLabel />
          </div>

          {/* Desktop: Language Switcher */}
          <div className="hidden md:block relative" ref={langDropdownRef}>
            <button
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-2 rounded-lg',
                'text-sm font-medium text-muted-foreground',
                'hover:text-foreground hover:bg-white/[0.04]',
                'transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
              style={{ minHeight: 44, minWidth: 44 }}
              aria-expanded={langDropdownOpen}
              aria-haspopup="listbox"
              aria-label={t('nav.language')}
            >
              <GlobeIcon className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline text-xs">
                {currentLocaleOption.code.toUpperCase()}
              </span>
              <ChevronDownIcon
                className={cn(
                  'size-3 transition-transform duration-200',
                  langDropdownOpen && 'rotate-180'
                )}
                aria-hidden="true"
              />
            </button>

            <AnimatePresence>
              {langDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.15,
                    ease: 'easeOut',
                  }}
                  className={cn(
                    'absolute right-0 top-full mt-1 w-36',
                    'rounded-lg border border-white/[0.08]',
                    'bg-[#14141f]/95 backdrop-blur-xl',
                    'shadow-lg shadow-black/30',
                    'py-1 overflow-hidden'
                  )}
                  role="listbox"
                  aria-label={t('nav.language')}
                >
                  {localeOptions.map((opt) => (
                    <button
                      key={opt.code}
                      role="option"
                      aria-selected={locale === opt.code}
                      onClick={() => handleLocaleChange(opt.code)}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2.5 text-sm',
                        'transition-colors duration-100',
                        locale === opt.code
                          ? 'text-[#ff2d78] bg-[#ff2d78]/5'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                      )}
                      style={{ minHeight: 44 }}
                    >
                      <span className="text-base leading-none" aria-hidden="true">
                        {opt.flag}
                      </span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop: User menu */}
          <UserMenu />

          {/* Mobile: Search icon (opens inline search in the header on mobile) */}
          <button
            onClick={() => setSearchExpanded(!searchExpanded)}
            className={cn(
              'flex sm:hidden items-center justify-center size-11 rounded-lg',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-white/[0.04]',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            aria-label={t('nav.search')}
          >
            <SearchIcon className="size-5" />
          </button>

          {/* Mobile: Hamburger menu */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className={cn(
              'flex md:hidden items-center justify-center size-11 rounded-lg',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-white/[0.04]',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
          >
            <MenuIcon className="size-5" />
          </button>
        </div>

        {/* Mobile: expanded search bar (slides down below header) */}
        <AnimatePresence>
          {searchExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.2,
                ease: 'easeOut',
              }}
              className="sm:hidden overflow-hidden border-b border-white/[0.06] bg-[#0a0a0f]/90 backdrop-blur-xl"
            >
              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center gap-2 px-4 py-3"
              >
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={t('nav.search')}
                    className={cn(
                      'h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04]',
                      'pl-9 pr-4 text-base text-foreground',
                      'placeholder:text-muted-foreground/60',
                      'focus:outline-none focus:border-[#00d4ff]/40 focus:ring-2 focus:ring-[#00d4ff]/10'
                    )}
                    autoFocus
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchExpanded(false);
                    setSearchValue('');
                  }}
                  className="shrink-0 size-11"
                  aria-label="Close search"
                >
                  <XIcon className="size-5" />
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Mobile navigation sheet */}
      <MobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
    </>
  );
}
