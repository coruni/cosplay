import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getGalleryBySlug, getRelatedGalleries } from '@/lib/data';
import { GalleryDetailClient } from '@/components/gallery/gallery-detail-client';
import { GalleryGrid } from '@/components/gallery/gallery-grid';
import { Badge } from '@/components/ui/badge';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  UserIcon,
  SparklesIcon,
  EyeIcon,
  CalendarIcon,
  TagIcon,
  FolderIcon,
  ArrowLeftIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrentUser, hasPurchasedGallery } from '@/lib/user-auth';
import { getSubscriptionStatus } from '@/lib/subscription';
import { getShowNsfwServer } from '@/lib/nsfw';
import type { Metadata } from 'next';
import type { Gallery } from '@/types';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const gallery = await getGalleryBySlug(slug);

  if (!gallery) {
    return { title: 'Not Found' };
  }

  const title =
    gallery.title[locale as keyof typeof gallery.title] ?? gallery.title.en;
  const description =
    gallery.description[locale as keyof typeof gallery.description] ??
    gallery.description.en;

  return {
    title: `${title} — ${gallery.cosplayer}`,
    description,
    openGraph: {
      title: `${title} — ${gallery.cosplayer}`,
      description,
      type: 'article',
      locale: locale === 'zh' ? 'zh_CN' : locale === 'ja' ? 'ja_JP' : 'en_US',
      images: [{ url: gallery.cover, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — ${gallery.cosplayer}`,
      description,
      images: [gallery.cover],
    },
    alternates: {
      languages: {
        zh: `/gallery/${slug}`,
        en: `/en/gallery/${slug}`,
        ja: `/ja/gallery/${slug}`,
      },
    },
  };
}

export default async function GalleryDetailPage({ params }: Props) {
  const { locale, slug } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);

  const gallery = await getGalleryBySlug(slug);

  if (!gallery) {
    notFound();
  }

  const showNsfw = await getShowNsfwServer();
  const relatedGalleries = await getRelatedGalleries(gallery, 4, showNsfw);

  // Check if current user has purchased this gallery (server-side, hydration-safe)
  const currentUser = await getCurrentUser();
  const isPurchased = await hasPurchasedGallery(currentUser?.id, gallery.id);
  const sub = currentUser ? await getSubscriptionStatus(currentUser.id) : null;
  const membershipActive = !!sub?.isActive;
  const quotaRemaining = sub?.quotaRemaining ?? 0;

  const t = await getTranslations({ locale, namespace: 'detail' });
  const tCat = await getTranslations({ locale, namespace: 'categories' });

  const title =
    gallery.title[locale as keyof typeof gallery.title] ?? gallery.title.en;
  const description =
    gallery.description[locale as keyof typeof gallery.description] ??
    gallery.description.en;

  const backHref = `/${locale}/gallery`;

  return (
    <div className="min-h-screen">
      {/* ========== Hero / Cover Image ========== */}
      <div className="relative w-full h-[50vh] sm:h-[60vh] lg:h-[70vh] overflow-hidden">
        <Image
          src={gallery.cover}
          alt={title}
          fill
          className="object-cover"
          priority
          unoptimized
          sizes="100vw"
        />

        {/* Gradient overlays */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, #0a0a0f 0%, rgba(10,10,15,0.8) 20%, rgba(10,10,15,0.3) 50%, rgba(10,10,15,0.1) 100%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 30% 50%, rgba(255,45,120,0.08) 0%, transparent 60%)',
          }}
        />

        {/* Back button */}
        <a
          href={backHref}
          className={cn(
            'absolute top-6 left-4 sm:left-6 lg:left-8 z-10',
            'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl',
            'text-sm font-medium text-white/80',
            'bg-black/30 backdrop-blur-md',
            'border border-white/[0.08]',
            'hover:bg-black/50 hover:text-white hover:border-white/[0.2]',
            'transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40'
          )}
          style={{ minHeight: 44 }}
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Back to Gallery</span>
        </a>
      </div>

      {/* ========== Gallery Metadata ========== */}
      <div className="relative -mt-20 sm:-mt-24 lg:-mt-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div
            className={cn(
              'rounded-2xl p-6 sm:p-8 lg:p-10',
              'bg-[#14141f]/90 backdrop-blur-xl',
              'border border-white/[0.06]',
              'shadow-2xl shadow-black/40'
            )}
          >
            {/* Rating + Price badges */}
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border',
                  gallery.rating === 'sfw'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                )}
              >
                {gallery.rating === 'nsfw' && (
                  <SparklesIcon className="size-3" aria-hidden="true" />
                )}
                {gallery.rating.toUpperCase()}
              </span>

              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border',
                  gallery.isPremium && gallery.price > 0
                    ? 'bg-[#ff2d78]/15 text-[#ff2d78] border-[#ff2d78]/30'
                    : gallery.isPremium
                    ? 'bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/30'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                )}
              >
                {gallery.isPremium && gallery.price > 0
                  ? `¥${gallery.price}`
                  : gallery.isPremium
                  ? '会员专享'
                  : 'Free'}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 leading-tight">
              {title}
            </h1>

            {/* Description */}
            <p className="text-base text-muted-foreground mb-6 leading-relaxed max-w-3xl">
              {description}
            </p>

            {/* Meta info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Cosplayer */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center justify-center size-10 rounded-lg bg-[#00d4ff]/10">
                  <UserIcon className="size-4 text-[#00d4ff]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('cosplayer')}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {gallery.cosplayer}
                  </p>
                </div>
              </div>

              {/* Character */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center justify-center size-10 rounded-lg bg-[#ff2d78]/10">
                  <SparklesIcon className="size-4 text-[#ff2d78]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('character')}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {gallery.character}
                  </p>
                </div>
              </div>

              {/* Series */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center justify-center size-10 rounded-lg bg-[#a855f7]/10">
                  <FolderIcon className="size-4 text-[#a855f7]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('series')}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {gallery.series}
                  </p>
                </div>
              </div>

              {/* Views + Date */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center justify-center size-10 rounded-lg bg-emerald-500/10">
                  <EyeIcon className="size-4 text-emerald-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Views</p>
                  <p className="text-sm font-semibold text-foreground">
                    {gallery.viewCount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <TagIcon className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="text-xs font-medium text-muted-foreground mr-1">
                {t('category')}:
              </span>
              {gallery.categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-muted-foreground"
                >
                  {tCat(cat as Parameters<typeof tCat>[0])}
                </span>
              ))}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap items-center gap-2">
              {gallery.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-[#00d4ff]/5 text-[#00d4ff]/80 border border-[#00d4ff]/10"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========== Client-side image grid & unlock ========== */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto">
          <GalleryDetailClient
            gallery={gallery}
            isPurchased={isPurchased}
            membershipActive={membershipActive}
            quotaRemaining={quotaRemaining}
          />
        </div>
      </div>

      {/* ========== Related Galleries ========== */}
      {relatedGalleries.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
          <div className="max-w-7xl mx-auto">
            <div className="relative mb-10">
              <div
                className="absolute top-0 left-0 w-20 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, #ff2d78, transparent)',
                }}
              />
              <h2 className="text-xl sm:text-2xl font-bold text-foreground pt-4">
                {t('relatedGalleries')}
              </h2>
            </div>
            <GalleryGrid galleries={relatedGalleries} />
          </div>
        </section>
      )}

      {/* ========== Structured Data (JSON-LD) ========== */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CreativeWork',
            name: title,
            description,
            image: gallery.cover,
            author: {
              '@type': 'Person',
              name: gallery.cosplayer,
            },
            about: {
              '@type': 'Thing',
              name: gallery.character,
            },
            dateCreated: gallery.createdAt,
            interactionStatistic: {
              '@type': 'InteractionCounter',
              interactionType: 'https://schema.org/WatchAction',
              userInteractionCount: gallery.viewCount,
            },
            offers: gallery.isPremium
              ? {
                  '@type': 'Offer',
                  price: gallery.price,
                  priceCurrency: 'CNY',
                }
              : undefined,
          }),
        }}
      />
    </div>
  );
}
