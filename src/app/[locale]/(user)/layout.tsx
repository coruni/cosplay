import { requireUserForPage } from '@/lib/user-auth';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { UserNav } from '@/components/user/user-nav';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUserForPage();
  return (
    <>
      <Header />
      <UserNav />
      <main className="flex-1 min-h-screen bg-[#1c1c28]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</div>
      </main>
      <Footer />
    </>
  );
}
