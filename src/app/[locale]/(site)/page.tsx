import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getFeaturedGalleries, getAllCategories } from '@/lib/data';
import { getShowNsfwServer } from '@/lib/nsfw';
import { HeroSection } from '@/components/home/hero-section';
import { FeaturedSection } from '@/components/home/featured-section';
import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });

  return {
    title: `${t('name')} — ${t('tagline')}`,
    description: t('description'),
    openGraph: {
      title: `${t('name')} — ${t('tagline')}`,
      description: t('description'),
      type: 'website',
      locale: locale === 'zh' ? 'zh_CN' : locale === 'ja' ? 'ja_JP' : 'en_US',
      siteName: t('name'),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t('name')} — ${t('tagline')}`,
      description: t('description'),
    },
    alternates: {
      languages: {
        zh: '/',
        en: '/en',
        ja: '/ja',
      },
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);

  const showNsfw = await getShowNsfwServer();
  const [featuredGalleries, categories] = await Promise.all([
    getFeaturedGalleries(6, showNsfw),
    getAllCategories(),
  ]);

  return (
    <div className="relative">
      {/* Hero Section — full-viewport, animated gradient mesh */}
      <HeroSection categories={categories} />

      {/* Featured Galleries Section */}
      <FeaturedSection galleries={featuredGalleries} />
    </div>
  );
}
