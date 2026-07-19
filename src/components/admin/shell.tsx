'use client';

import { useState, type ReactNode } from 'react';
import { AdminSidebar } from './sidebar';
import { AdminHeader } from './header';

interface AdminShellProps {
  children: ReactNode;
}

/**
 * AdminShell — client wrapper that owns the mobile drawer state so the
 * header hamburger and the sidebar share one source of truth.
 */
export function AdminShell({ children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#1c1c28]">
      <AdminSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="lg:pl-60 transition-all duration-300">
        <AdminHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
