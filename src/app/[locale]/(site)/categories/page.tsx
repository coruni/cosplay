import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAllCategories, getGalleries } from '@/lib/data';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import { GalleryGrid } from '@/components/gallery/gallery-grid';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav' });
  return {
    title: `${t('categories')} — CosHub`,
    description: 'Browse cosplay galleries by category on CosHub.',
  };
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'categories' });
  const categories = await getAllCategories();

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #ff2d78 0%, #ff6b9d 50%, #ff2d78 100%)',
                fontFamily: 'Orbitron, sans-serif',
              }}
            >
              {t('game')}
            </span>
            <span className="text-foreground/60"> & </span>
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #00d4ff 0%, #66e3ff 50%, #00d4ff 100%)',
                fontFamily: 'Orbitron, sans-serif',
              }}
            >
              Beyond
            </span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Browse cosplay galleries by category — from game characters to original designs.
          </p>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {categories.map((cat, index) => {
            const label = t(cat as keyof typeof t) || cat;
            return (
              <Link
                key={cat}
                href={`/${locale}/gallery?category=${cat}`}
                className={cn(
                  'group relative overflow-hidden rounded-xl border border-white/[0.06]',
                  'bg-[#14141f]/80 backdrop-blur-sm',
                  'p-6 flex flex-col items-center justify-center gap-3',
                  'hover:border-[#ff2d78]/30 hover:bg-[#14141f]',
                  'transition-all duration-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2d78]/50',
                  'min-h-[120px]'
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {/* Icon placeholder */}
                <div
                  className={cn(
                    'size-12 rounded-full flex items-center justify-center',
                    'bg-gradient-to-br from-[#ff2d78]/10 to-[#00d4ff]/10',
                    'group-hover:from-[#ff2d78]/20 group-hover:to-[#00d4ff]/20',
                    'transition-all duration-300'
                  )}
                >
                  <span className="text-2xl">
                    {cat === 'game' ? '🎮' :
                     cat === 'anime' ? '🎬' :
                     cat === 'manga' ? '📚' :
                     cat === 'movie' ? '🎥' :
                     cat === 'original' ? '✨' :
                     cat === 'swimsuit' ? '🏖️' :
                     cat === 'lingerie' ? '💋' :
                     cat === 'school' ? '🎒' :
                     cat === 'fantasy' ? '🧙' : '📷'}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                  {label}
                </span>

                {/* Hover glow */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    boxShadow: 'inset 0 0 40px rgba(255,45,120,0.06)',
                  }}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
