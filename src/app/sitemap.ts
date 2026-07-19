import { routing } from '@/i18n/routing';
import { getAllCategories, getGalleries } from '@/lib/data';
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://coshub.example.com';

  // Static pages for all locales
  const staticPages = routing.locales.flatMap((locale) => {
    return [
      { url: `${baseUrl}/${locale}`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
      { url: `${baseUrl}/${locale}/gallery`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
      { url: `${baseUrl}/${locale}/categories`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    ];
  });

  // Gallery detail pages
  const { items: galleries } = await getGalleries({ pageSize: 1000 });
  const galleryPages = galleries.flatMap((gallery) => {
    return routing.locales.map((locale) => ({
      url: `${baseUrl}/${locale}/gallery/${gallery.slug}`,
      lastModified: new Date(gallery.createdAt),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }));
  });

  return [...staticPages, ...galleryPages];
}
