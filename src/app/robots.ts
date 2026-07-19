import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getSiteUrl();

  return {
    rules: [
      // Search-engine crawlers: allowed everywhere except API, admin and the
      // payment webhook. NSFW detail pages opt out individually via a
      // `<meta name="robots" content="noindex">` tag, so they are fetched but
      // never shown in results (prevents the domain from being flagged).
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/payment/notify/'],
      },
      // AI / content-extraction crawlers: keep them off the gallery image area
      // (where NSFW covers live) so adult images are never ingested/trained on.
      // Search engines above remain allowed; NSFW is still excluded by noindex.
      {
        userAgent: [
          'GPTBot',
          'ClaudeBot',
          'CCBot',
          'Bytespider',
          'Google-Extended',
          'FacebookBot',
          'Applebot',
          'Omgilibot',
          'PetalBot',
        ],
        disallow: ['/gallery/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
