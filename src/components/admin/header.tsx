'use client';

import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { MenuIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const titleMap: Record<string, string> = {
  '/admin': '仪表盘',
  '/admin/galleries': '图包管理',
  '/admin/orders': '订单管理',
  '/admin/users': '用户管理',
};

interface AdminHeaderProps {
  onMenuClick?: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const pathname = usePathname();
  const locale = useLocale();

  // Derive the page title from the current path (strip the locale prefix).
  const withoutLocale = pathname.replace(`/${locale}`, '') || '/admin';
  const title = titleMap[withoutLocale] || '仪表盘';

  return (
    <header
      className={cn(
        'sticky top-0 z-30 h-16',
        'bg-[#0a0a0f]/80 backdrop-blur-xl',
        'border-b border-white/[0.06]',
        'flex items-center gap-4 px-4 lg:px-6'
      )}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden flex items-center justify-center size-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
        aria-label="打开菜单"
        style={{ minHeight: 44, minWidth: 44 }}
      >
        <MenuIcon className="size-5" />
      </button>

      {/* Title */}
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Admin badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
        <div className="size-6 rounded-full bg-[#ff2d78]/20 flex items-center justify-center">
          <span className="text-xs font-bold text-[#ff2d78]">A</span>
        </div>
        <span className="text-sm text-muted-foreground">Admin</span>
      </div>
    </header>
  );
}
