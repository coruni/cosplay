'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  UserIcon,
  LogOutIcon,
  ShoppingBagIcon,
  ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SafeUser } from '@/types';

/**
 * UserMenu — header user entry.
 *
 * - SSR + client first paint: loading=true → renders nothing (hydration-safe).
 * - After mount: fetch /api/user/me → show login button (if logged out) or
 *   avatar dropdown with account/orders/purchased/logout (if logged in).
 */
export function UserMenu() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('user');

  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await fetch('/api/user/logout', { method: 'POST' });
    setUser(null);
    setMenuOpen(false);
    router.refresh();
  };

  // Hydration-safe: render nothing during loading (SSR + first paint)
  if (loading) return null;

  // Not logged in
  if (!user) {
    return (
      <Link
        href={`/${locale}/login`}
        className={cn(
          'hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg',
          'text-sm font-medium text-muted-foreground',
          'hover:text-foreground hover:bg-white/[0.04]',
          'transition-colors duration-150'
        )}
        style={{ minHeight: 44 }}
      >
        <UserIcon className="size-4" aria-hidden="true" />
        {t('login')}
      </Link>
    );
  }

  // Logged in — avatar dropdown
  const initial = (user.nickname || user.username || '?')
    .charAt(0)
    .toUpperCase();

  return (
    <div className="hidden md:block relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={cn(
          'flex items-center justify-center size-11 rounded-lg',
          'hover:bg-white/[0.04] transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        style={{ minHeight: 44, minWidth: 44 }}
        aria-label={t('account')}
        aria-expanded={menuOpen}
      >
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt=""
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <div className="size-8 rounded-full bg-[#ff2d78]/20 flex items-center justify-center text-sm font-semibold text-[#ff2d78]">
            {initial}
          </div>
        )}
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className={cn(
              'absolute right-0 top-full mt-1 w-48',
              'rounded-lg border border-white/[0.08]',
              'bg-[#262633]/95 backdrop-blur-xl',
              'shadow-lg shadow-black/30',
              'py-1 z-50'
            )}
            role="menu"
          >
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <p className="text-sm font-medium text-foreground truncate">
                {user.nickname || user.username}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
            <Link
              href={`/${locale}/account`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
              role="menuitem"
            >
              <UserIcon className="size-4" aria-hidden="true" />
              {t('account')}
            </Link>
            <Link
              href={`/${locale}/account/orders`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
              role="menuitem"
            >
              <ShoppingBagIcon className="size-4" aria-hidden="true" />
              {t('orders')}
            </Link>
            <Link
              href={`/${locale}/account/purchased`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
              role="menuitem"
            >
              <ImageIcon className="size-4" aria-hidden="true" />
              {t('purchased')}
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-muted-foreground hover:text-red-400 hover:bg-white/[0.04] transition-colors"
              role="menuitem"
            >
              <LogOutIcon className="size-4" aria-hidden="true" />
              {t('logout')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
