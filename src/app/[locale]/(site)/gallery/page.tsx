import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getGalleries, getGalleryCategoryOptions } from '@/lib/data';
import { getShowNsfwServer } from '@/lib/nsfw';
import { GalleryFilter } from '@/components/gallery/gallery-filter';
import { GalleryGrid } from '@/components/gallery/gallery-grid';
import { GalleryPagination } from '@/components/gallery/gallery-pagination';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { SortOption } from '@/types';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    query?: string;
    category?: string;
    sort?: string;
    page?: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });

  return {
    title: `${t('name')} — Gallery`,
    description: t('description'),
    openGraph: {
      title: `${t('name')} — Gallery`,
      description: t('description'),
      type: 'website',
      locale: locale === 'zh' ? 'zh_CN' : locale === 'ja' ? 'ja_JP' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t('name')} — Gallery`,
      description: t('description'),
    },
    alternates: {
      languages: {
        zh: '/gallery',
        en: '/en/gallery',
        ja: '/ja/gallery',
      },
    },
  };
}

export default async function GalleryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);

  // Parse search params
  const query = sp.query ?? '';
  const category = sp.category ?? '';
  const sort = (sp.sort as SortOption) || 'newest';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  // DB-layer NSFW filter driven by the cookie preference (server-side).
  const showNsfw = await getShowNsfwServer();

  // Fetch data
  const [result, categories] = await Promise.all([
    getGalleries({
      query: query || undefined,
      category: category || undefined,
      rating: showNsfw ? 'all' : 'sfw',
      sort,
      page,
      pageSize: 12,
    }),
    getGalleryCategoryOptions(),
  ]);

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="relative pt-24 pb-8 sm:pt-32 sm:pb-12 px-4 sm:px-6 lg:px-8">
        {/* Background accent */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.06) 0%, transparent 60%)',
          }}
        />

        <div className="relative max-w-7xl mx-auto">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3">
            Gallery
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
            Browse all curated cosplay collections. Use filters to find your perfect match.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-16 z-30 px-4 sm:px-6 lg:px-8 pb-4">
        <div className="max-w-7xl mx-auto">
          <GalleryFilter
            categories={categories}
            currentCategory={category}
            currentSort={sort}
            currentQuery={query}
          />
        </div>
      </div>

      {/* Results */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Results count */}
          {result.total > 0 && (
            <p className="text-sm text-muted-foreground mb-6">
              {result.total} {result.total === 1 ? 'gallery' : 'galleries'} found
              {query && (
                <>
                  {' '}for &ldquo;<span className="text-foreground">{query}</span>&rdquo;
                </>
              )}
            </p>
          )}

          <GalleryGrid
            galleries={result.items}
            totalCount={result.total}
            showNsfw={showNsfw}
          />

          {/* Pagination */}
          {result.totalPages > 1 && (
            <GalleryPagination
              currentPage={result.page}
              totalPages={result.totalPages}
            />
          )}
        </div>
      </div>
    </div>
  );
}
