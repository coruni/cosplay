'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { UserIcon, ShoppingBagIcon, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { key: 'account', href: '/account', icon: UserIcon },
  { key: 'orders', href: '/account/orders', icon: ShoppingBagIcon },
  { key: 'purchased', href: '/account/purchased', icon: ImageIcon },
];

export function UserNav() {
  const t = useTranslations('user');
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav className="border-b border-white/[0.06] bg-[#0a0a0f]/60 backdrop-blur-md sticky top-16 z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
        {navItems.map((item) => {
          const href = `/${locale}${item.href}`;
          const isActive =
            pathname === href ||
            (item.href !== '/account' && pathname.startsWith(href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'text-[#ff2d78] border-b-2 border-[#ff2d78]'
                  : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(item.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
