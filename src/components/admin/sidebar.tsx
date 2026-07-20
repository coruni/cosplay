'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboardIcon,
  ImageIcon,
  CreditCardIcon,
  UsersIcon,
  TagsIcon,
  LogOutIcon,
  XIcon,
  ChevronLeftIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NavKey = 'dashboard' | 'galleries' | 'categories' | 'orders' | 'users';

const navItems: { href: string; key: NavKey; icon: typeof LayoutDashboardIcon }[] = [
  { href: '/admin', key: 'dashboard', icon: LayoutDashboardIcon },
  { href: '/admin/galleries', key: 'galleries', icon: ImageIcon },
  { href: '/admin/categories', key: 'categories', icon: TagsIcon },
  { href: '/admin/orders', key: 'orders', icon: CreditCardIcon },
  { href: '/admin/users', key: 'users', icon: UsersIcon },
];

interface AdminSidebarProps {
  /** Mobile drawer open state (owned by AdminShell) */
  mobileOpen: boolean;
  /** Close the mobile drawer */
  onCloseMobile: () => void;
}

export function AdminSidebar({ mobileOpen, onCloseMobile }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const tNav = useTranslations('admin.nav');
  const tCommon = useTranslations('admin.common');
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    document.cookie = 'admin_token=; path=/; max-age=0';
    router.push(`/${locale}/admin/login`);
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onCloseMobile}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-60',
          'bg-[#0c0c14] border-r border-white/[0.06]',
          'flex flex-col',
          'transition-all duration-300 ease-in-out',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed && 'lg:w-16 lg:items-center'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-4 border-b border-white/[0.06] shrink-0">
          <div
            className="size-8 rounded-lg bg-[#ff2d78]/15 flex items-center justify-center shrink-0"
            style={{ boxShadow: '0 0 12px rgba(255,45,120,0.2)' }}
          >
            <span
              className="text-sm font-bold text-[#ff2d78]"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              C
            </span>
          </div>
          {!collapsed && (
            <span
              className="text-sm font-bold tracking-wider text-foreground"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              CosHub Admin
            </span>
          )}
          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="lg:flex hidden ml-auto size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
            aria-label={collapsed ? tCommon('expandSidebar') : tCommon('collapseSidebar')}
          >
            <ChevronLeftIcon
              className={cn('size-4 transition-transform', collapsed && 'rotate-180')}
            />
          </button>
          {/* Mobile close */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden ml-auto size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label={tCommon('closeMenu')}
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const href = `/${locale}${item.href}`;
            const isActive = pathname === href;

            return (
              <a
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  'hover:bg-white/[0.04]',
                  isActive
                    ? 'bg-[#ff2d78]/10 text-[#ff2d78]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                style={{ minHeight: 44 }}
              >
                <Icon className="size-5 shrink-0" />
                {!collapsed && <span>{tNav(item.key)}</span>}
              </a>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-2 py-4 border-t border-white/[0.06] shrink-0">
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium',
              'text-muted-foreground hover:text-red-400 hover:bg-red-500/10',
              'transition-all duration-150'
            )}
            style={{ minHeight: 44 }}
          >
            <LogOutIcon className="size-5 shrink-0" />
            {!collapsed && <span>{tCommon('logout')}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
