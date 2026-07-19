import { Gallery } from '@/types';
import { localeAlternates } from '@/i18n/routing';

export function GalleryJsonLd({
  gallery,
  locale,
  url,
}: {
  gallery: Gallery;
  locale: string;
  url: string;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: gallery.title[locale as keyof typeof gallery.title] || gallery.title.zh,
    description:
      gallery.description[locale as keyof typeof gallery.description] ||
      gallery.description.zh,
    url,
    image: gallery.images.map((img) => ({
      '@type': 'ImageObject',
      contentUrl: img,
    })),
    creator: {
      '@type': 'Person',
      name: gallery.cosplayer,
    },
    about: {
      '@type': 'CreativeWork',
      name: gallery.character,
    },
    dateCreated: gallery.createdAt,
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ViewAction',
        userInteractionCount: gallery.viewCount,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/DownloadAction',
        userInteractionCount: gallery.downloadCount,
      },
    ],
    offers: gallery.isPremium
      ? {
          '@type': 'Offer',
          price: gallery.price,
          priceCurrency: 'CNY',
          availability: 'https://schema.org/InStock',
        }
      : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebsiteJsonLd({ locale }: { locale: string }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CosHub',
    description: {
      zh: 'CosHub 是一个收集展示高质量 Cosplay 图包的平台。',
      en: 'CosHub is a platform for collecting and showcasing high-quality cosplay photo sets.',
      ja: 'CosHubは、高品質なコスプレ写真集を収集・展示するプラットフォームです。',
    }[locale] || 'CosHub cosplay gallery platform.',
    url: `https://coshub.example.com/${locale === 'zh' ? '' : locale}`,
    inLanguage: localeAlternates[locale] || 'zh-CN',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `https://coshub.example.com/${locale === 'zh' ? '' : locale + '/'}gallery?query={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
