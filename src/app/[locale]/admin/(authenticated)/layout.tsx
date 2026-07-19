import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getTokenFromCookies, validateToken } from '@/lib/auth';
import { AdminShell } from '@/components/admin/shell';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CosHub Admin',
  robots: 'noindex, nofollow',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const token = getTokenFromCookies(cookieHeader);

  const locale = await getLocale();
  if (!token || !validateToken(token)) {
    redirect(`/${locale}/admin/login`);
  }

  return <AdminShell>{children}</AdminShell>;
}
