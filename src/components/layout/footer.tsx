'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useTranslations, useLocale } from 'next-intl';
import {
  HeartIcon,
  ExternalLinkIcon,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface FooterLink {
  href: string;
  labelKey: string;
  external?: boolean;
}

interface FooterColumn {
  titleKey: string;
  links: FooterLink[];
}

/**
 * Site footer with 4-column grid layout on desktop, stacked on mobile.
 *
 * Columns:
 * 1. About CosHub — brand description
 * 2. Browse — main navigation links
 * 3. Support — FAQ & Contact
 * 4. Legal — Privacy & Terms
 *
 * Design notes:
 * - Dark background with subtle top border glow (cyberpunk aesthetic)
 * - Framer Motion fade-in + slide-up on scroll into view
 * - Links with electric blue hover accent
 * - Bottom copyright bar
 * - All touch targets ≥ 44px
 */
export function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();
  const footerRef = useRef<HTMLElement>(null);
  const isInView = useInView(footerRef, {
    once: true,
    margin: '0px 0px -50px 0px',
  });

  const localizedHref = (href: string) => {
    return `/${locale}${href === '/' ? '' : href}`;
    return `/${locale}${href === '/' ? '' : href}`;
  };

  const columns: FooterColumn[] = [
    {
      titleKey: 'footer.about',
      links: [], // Handled specially — description instead of links
    },
    {
      titleKey: 'footer.browse',
      links: [
        { href: '/', labelKey: 'nav.home' },
        { href: '/gallery', labelKey: 'nav.gallery' },
        { href: '/categories', labelKey: 'nav.categories' },
      ],
    },
    {
      titleKey: 'footer.support',
      links: [
        { href: '/faq', labelKey: 'footer.faq' },
        { href: '/contact', labelKey: 'footer.contact' },
      ],
    },
    {
      titleKey: 'footer.legal',
      links: [
        { href: '/privacy', labelKey: 'footer.privacy' },
        { href: '/terms', labelKey: 'footer.terms' },
      ],
    },
  ];

  return (
    <motion.footer
      ref={footerRef}
      initial={
        shouldReduceMotion ? undefined : { opacity: 0, y: 40 }
      }
      animate={
        shouldReduceMotion
          ? { opacity: 1, y: 0 }
          : isInView
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y: 40 }
      }
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
      }
      className="relative mt-auto"
    >
      {/* Subtle top border glow — the cyberpunk accent */}
      <div className="relative">
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,45,120,0.3) 25%, rgba(0,212,255,0.3) 50%, rgba(168,85,247,0.3) 75%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-8 -translate-y-4 blur-xl"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,45,120,0.08) 30%, rgba(0,212,255,0.06) 50%, rgba(168,85,247,0.08) 70%, transparent 100%)',
          }}
        />
      </div>

      {/* Main footer content */}
      <div className="bg-[#1c1c28]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Column 1: About */}
            <div className="sm:col-span-2 lg:col-span-1">
              <h3 className="text-sm font-semibold text-foreground/90 mb-4 uppercase tracking-wider">
                {t('footer.about')}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {t('footer.aboutDesc')}
              </p>
              {/* Brand accent */}
              <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground/60">
                <HeartIcon className="size-3 text-[#ff2d78]" aria-hidden="true" />
                <span>Made with passion for cosplay culture</span>
              </div>
            </div>

            {/* Columns 2-4: Link groups */}
            {columns.slice(1).map((column) => (
              <div key={column.titleKey}>
                <h3 className="text-sm font-semibold text-foreground/90 mb-4 uppercase tracking-wider">
                  {t(column.titleKey)}
                </h3>
                <ul className="space-y-2.5" role="list">
                  {column.links.map((link) => (
                    <li key={link.labelKey}>
                      <a
                        href={localizedHref(link.href)}
                        target={link.external ? '_blank' : undefined}
                        rel={
                          link.external
                            ? 'noopener noreferrer'
                            : undefined
                        }
                        className={cn(
                          'group inline-flex items-center gap-1.5',
                          'text-sm text-muted-foreground',
                          'hover:text-[#00d4ff] transition-colors duration-150',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c28]',
                          'rounded-md px-1 py-1 -mx-1'
                        )}
                        style={{ minHeight: 36 }}
                      >
                        <span className="relative">
                          {t(link.labelKey)}
                          {/* Electric blue underline on hover */}
                          <span
                            className="absolute -bottom-0.5 left-0 h-px w-0 rounded-full transition-all duration-200 group-hover:w-full"
                            style={{
                              background:
                                'linear-gradient(90deg, #00d4ff, transparent)',
                            }}
                          />
                        </span>
                        {link.external && (
                          <ExternalLinkIcon
                            className="size-3 opacity-50 group-hover:opacity-100 transition-opacity"
                            aria-hidden="true"
                          />
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Separator */}
        <Separator className="bg-white/[0.04]" />

        {/* Bottom bar */}
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            {/* Copyright */}
            <p className="text-xs text-muted-foreground/60">
              {t('footer.copyright')}
            </p>

            {/* Logo mark */}
            <span
              className="text-xs font-bold tracking-[0.2em] text-transparent bg-clip-text select-none opacity-40"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #ff2d78, #00d4ff)',
                fontFamily: 'Orbitron, sans-serif',
              }}
            >
              COSHUB
            </span>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
