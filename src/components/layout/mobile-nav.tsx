'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useTranslations, useLocale } from 'next-intl';
import {
  HomeIcon,
  ImageIcon,
  Grid3X3Icon,
  GlobeIcon,
  XIcon,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { NsfwToggle } from '@/components/layout/nsfw-toggle';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Called when the sheet should close */
  onClose: () => void;
}

interface NavLink {
  href: string;
  labelKey: 'nav.home' | 'nav.gallery' | 'nav.categories';
  icon: React.ComponentType<{ className?: string }>;
}

const locales = [
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
] as const;

const navLinks: NavLink[] = [
  { href: '/', labelKey: 'nav.home', icon: HomeIcon },
  { href: '/gallery', labelKey: 'nav.gallery', icon: ImageIcon },
  { href: '/categories', labelKey: 'nav.categories', icon: Grid3X3Icon },
];

/**
 * Mobile navigation drawer that slides in from the right.
 *
 * Contains all primary navigation links, NSFW toggle, and language switcher.
 * Uses a semi-transparent dark backdrop with glassmorphism panel.
 * Touch targets are at minimum 44x44px throughout.
 */
export function MobileNav({ open, onClose }: MobileNavProps) {
  const t = useTranslations();
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();

  const handleLinkClick = useCallback(() => {
    // Small delay so the user sees the link press before the sheet closes
    onClose();
  }, [onClose]);

  const handleLocaleChange = useCallback(
    (newLocale: string) => {
      // Navigate by constructing the URL manually
      // next-intl v4 with as-needed prefix: default locale (zh) has no prefix
      const currentPath = window.location.pathname;
      // Remove existing locale prefix if present
      const pathWithoutLocale = currentPath.replace(
        /^\/(zh|en|ja)(\/|$)/,
        '/'
      );
      // Build new path
      const newPath =
        newLocale === 'zh'
          ? pathWithoutLocale
          : `/${newLocale}${pathWithoutLocale}`;
      window.location.href = newPath;
    },
    []
  );

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className={cn(
          'w-[280px] sm:w-[320px] p-0',
          // Cyberpunk glassmorphism styling
          'bg-[#0a0a0f]/95 backdrop-blur-xl border-l border-white/[0.06]',
          // Subtle inner glow on the left edge
          'shadow-[-8px_0_32px_rgba(0,0,0,0.5)]'
        )}
        showCloseButton={false}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <SheetHeader className="p-0">
            <SheetTitle className="font-heading text-lg">
              <span
                className="font-bold tracking-wider text-transparent bg-clip-text"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, #ff2d78 0%, #ff6b9d 50%, #ff2d78 100%)',
                  filter: 'drop-shadow(0 0 8px rgba(255,45,120,0.5))',
                  fontFamily: 'Orbitron, sans-serif',
                }}
              >
                CosHub
              </span>
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('site.description')}
            </SheetDescription>
          </SheetHeader>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('nav.home') ? 'Close menu' : '关闭菜单'}
            className="size-11 text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <XIcon className="size-5" />
          </Button>
        </div>

        <Separator className="bg-white/[0.06]" />

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-4" aria-label="Mobile navigation">
          <ul className="space-y-1" role="list">
            {navLinks.map((link, index) => {
              const Icon = link.icon;
              const href = `/${locale}${link.href === '/' ? '' : link.href}`;

              return (
                <motion.li
                  key={link.labelKey}
                  initial={
                    shouldReduceMotion
                      ? undefined
                      : { opacity: 0, x: 20 }
                  }
                  animate={{ opacity: 1, x: 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { delay: index * 0.06, duration: 0.25, ease: 'easeOut' }
                  }
                >
                  <a
                    href={href}
                    onClick={handleLinkClick}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg',
                      'text-base font-medium text-foreground/80',
                      'hover:bg-white/[0.06] hover:text-foreground',
                      'active:bg-white/[0.1]',
                      'transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]'
                    )}
                    style={{ minHeight: 44 }}
                  >
                    <Icon className="size-5 shrink-0 text-[#00d4ff]" aria-hidden="true" />
                    {t(link.labelKey)}
                  </a>
                </motion.li>
              );
            })}
          </ul>
        </nav>

        <Separator className="bg-white/[0.06]" />

        {/* Bottom section: NSFW toggle + language switcher */}
        <div className="px-4 py-4 space-y-4">
          {/* NSFW Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('nsfw.toggle')}
            </span>
            <NsfwToggle size="sm" />
          </div>

          {/* Language Switcher */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GlobeIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">
                {t('nav.language')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {locales.map(({ code, label, flag }) => (
                <button
                  key={code}
                  onClick={() => handleLocaleChange(code)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg',
                    'text-sm font-medium transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    locale === code
                      ? 'bg-[#ff2d78]/10 text-[#ff2d78] shadow-[0_0_12px_rgba(255,45,120,0.15)]'
                      : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
                  )}
                  style={{ minHeight: 44 }}
                  aria-label={`Switch language to ${label}`}
                  aria-current={locale === code ? 'true' : undefined}
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {flag}
                  </span>
                  <span className="text-xs">{code.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
