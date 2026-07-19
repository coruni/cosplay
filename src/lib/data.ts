import { prisma } from './db';
import { cacheGet, cacheSet, cacheDelete, CACHE_TTL, incrementViewCount, getViewCount } from './redis';
import { resolveImageUrl } from './s3';
import type { Gallery, GalleryFilter, Locale } from '@/types';
import { Prisma } from '@prisma/client';

export interface PaginatedResult {
  items: Gallery[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Convert Prisma DB row → Gallery app type */
export function toGallery(row: Prisma.GalleryGetPayload<object>): Gallery {
  return {
    id: row.id,
    slug: row.slug,
    title: { zh: row.titleZh, en: row.titleEn, ja: row.titleJa },
    description: { zh: row.descriptionZh, en: row.descriptionEn, ja: row.descriptionJa },
    cosplayer: row.cosplayer,
    character: row.character,
    series: row.series,
    cover: resolveImageUrl(row.cover),
    images: row.images.map(resolveImageUrl),
    categories: row.categories,
    tags: row.tags,
    rating: row.rating as 'sfw' | 'nsfw',
    price: row.price,
    isPremium: row.isPremium,
    createdAt: row.createdAt.toISOString(),
    viewCount: row.viewCount,
    downloadCount: row.downloadCount,
    downloadUrl: row.downloadUrl ?? undefined,
  };
}

export async function getGalleries(filter: GalleryFilter = {}): Promise<PaginatedResult> {
  const {
    query,
    category,
    rating = 'all',
    sort = 'newest',
    page = 1,
    pageSize = 12,
  } = filter;

  // Build cache key
  const cacheKey = `galleries:${JSON.stringify(filter)}`;

  // Try cache first (skip if query present — search shouldn't be cached heavily)
  if (!query) {
    const cached = await cacheGet<PaginatedResult>(cacheKey);
    if (cached) return cached;
  }

  // Build Prisma where clause
  const where: Prisma.GalleryWhereInput = {};

  if (query) {
    const q = query.toLowerCase();
    where.OR = [
      { titleZh: { contains: q, mode: 'insensitive' } },
      { titleEn: { contains: q, mode: 'insensitive' } },
      { titleJa: { contains: q, mode: 'insensitive' } },
      { cosplayer: { contains: q, mode: 'insensitive' } },
      { character: { contains: q, mode: 'insensitive' } },
      { series: { contains: q, mode: 'insensitive' } },
      { tags: { hasSome: [q] } },
    ];
  }

  if (category && category !== 'all') {
    where.categories = { has: category };
  }

  if (rating !== 'all') {
    where.rating = rating;
  }

  // Build orderBy
  let orderBy: Prisma.GalleryOrderByWithRelationInput = {};
  switch (sort) {
    case 'newest':
      orderBy = { createdAt: 'desc' };
      break;
    case 'popular':
      orderBy = { viewCount: 'desc' };
      break;
    case 'price-low':
      orderBy = { price: 'asc' };
      break;
  }

  const [total, items] = await Promise.all([
    prisma.gallery.count({ where }),
    prisma.gallery.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const result: PaginatedResult = {
    items: items.map(toGallery),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };

  // Cache the result
  if (!query) {
    await cacheSet(cacheKey, result, CACHE_TTL.GALLERY_LIST);
  }

  return result;
}

export async function getGalleryBySlug(slug: string): Promise<Gallery | null> {
  const cacheKey = `gallery:${slug}`;

  // Try cache
  const cached = await cacheGet<Gallery>(cacheKey);
  if (cached) return cached;

  const row = await prisma.gallery.findUnique({ where: { slug } });
  if (!row) return null;

  // Merge Redis view count
  const redisViews = await getViewCount(slug);
  const gallery = toGallery(row);
  if (redisViews > 0) {
    gallery.viewCount += redisViews;
  }

  // Cache
  await cacheSet(cacheKey, gallery, CACHE_TTL.GALLERY_DETAIL);

  return gallery;
}

export async function getRelatedGalleries(
  gallery: Gallery,
  limit = 4,
  showNsfw = false
): Promise<Gallery[]> {
  const where: Prisma.GalleryWhereInput = {
    id: { not: gallery.id },
    OR: [
      { categories: { hasSome: gallery.categories } },
      { rating: gallery.rating },
    ],
  };

  // DB-layer NSFW filter: exclude NSFW rows unless the user opted in.
  if (!showNsfw) {
    where.rating = 'sfw';
  }

  const rows = await prisma.gallery.findMany({
    where,
    take: limit,
    orderBy: { viewCount: 'desc' },
  });

  return rows.map(toGallery);
}

export async function getAllCategories(): Promise<string[]> {
  const cacheKey = 'categories:all';
  const cached = await cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  // Use raw query to get distinct categories from array column
  const result = await prisma.$queryRaw<{ category: string }[]>`
    SELECT DISTINCT unnest(categories) as category FROM "Gallery" ORDER BY category
  `;

  const categories = result.map((r) => r.category);

  await cacheSet(cacheKey, categories, CACHE_TTL.CATEGORIES);
  return categories;
}

export async function getFeaturedGalleries(
  limit = 6,
  showNsfw = false
): Promise<Gallery[]> {
  // Cache key must include showNsfw, otherwise SFW/NSFW results would collide.
  const cacheKey = `galleries:featured:${limit}:${showNsfw ? 'all' : 'sfw'}`;
  const cached = await cacheGet<Gallery[]>(cacheKey);
  if (cached) return cached;

  const rows = await prisma.gallery.findMany({
    // DB-layer NSFW filter: exclude NSFW rows unless the user opted in.
    where: showNsfw ? undefined : { rating: 'sfw' },
    orderBy: { viewCount: 'desc' },
    take: limit,
  });

  const galleries = rows.map(toGallery);

  await cacheSet(cacheKey, galleries, CACHE_TTL.FEATURED);
  return galleries;
}

/** Record a view (Redis counter) */
export async function recordView(slug: string): Promise<void> {
  await incrementViewCount(slug);
}

/** Invalidate caches when data changes */
export async function invalidateGalleryCaches(): Promise<void> {
  await cacheDelete('galleries:*');
  await cacheDelete('gallery:*');
  await cacheDelete('categories:*');
}
