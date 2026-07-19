import { Rating } from '@/types';

export function filterGalleriesByRating<T extends { rating: Rating }>(
  items: T[],
  showNsfw: boolean
): T[] {
  if (showNsfw) return items;
  return items.filter((item) => item.rating === 'sfw');
}

export function getRatingLabel(rating: Rating, locale: string): string {
  const labels: Record<string, Record<Rating, string>> = {
    zh: { sfw: '全年龄', nsfw: 'NSFW' },
    en: { sfw: 'SFW', nsfw: 'NSFW' },
    ja: { sfw: '一般', nsfw: 'NSFW' },
  };
  return labels[locale]?.[rating] ?? rating.toUpperCase();
}

export function getRatingColor(rating: Rating): string {
  return rating === 'sfw'
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : 'bg-violet-500/20 text-violet-400 border-violet-500/30';
}
