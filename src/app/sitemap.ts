import { routing } from '@/i18n/routing';
import { getAllCategories, getGalleries } from '@/lib/data';
import { getSiteUrl } from '@/lib/site';
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getSiteUrl();
  const locales = routing.locales;

  // Static pages for every locale.
  const staticPages = locales.flatMap((locale) => [
    { url: `${baseUrl}/${locale}`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    { url: `${baseUrl}/${locale}/gallery`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/${locale}/categories`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${baseUrl}/${locale}/faq`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.4 },
    { url: `${baseUrl}/${locale}/contact`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.4 },
    { url: `${baseUrl}/${locale}/privacy`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${baseUrl}/${locale}/terms`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.3 },
  ]);

  // Category listing pages (SFW by default for crawlers).
  const categories = await getAllCategories();
  const categoryPages = locales.flatMap((locale) =>
    categories.map((cat) => ({
      url: `${baseUrl}/${locale}/gallery?category=${encodeURIComponent(cat)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))
  );

  // Gallery detail pages — SFW ONLY.
  // NSFW galleries are intentionally excluded so they never reach crawlers;
  // their own <meta name="robots" content="noindex"> is the second guard.
  const { items: galleries } = await getGalleries({ pageSize: 1000, rating: 'sfw' });
  const galleryPages = galleries.flatMap((gallery) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}/gallery/${gallery.slug}`,
      lastModified: new Date(gallery.createdAt),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }))
  );

  return [...staticPages, ...categoryPages, ...galleryPages];
}
