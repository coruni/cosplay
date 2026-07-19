import type { CategoryNameMap } from '@/types';

/**
 * Resolve the localized display name for a category.
 *
 * @param name   The `{ zh, en, ja }` name payload from the Category table (may be null/undefined).
 * @param locale Current locale string (e.g. "zh" | "en" | "ja").
 * @param fallback Value to use when no localized name is available (typically the slug).
 */
export function localizedCategoryName(
  name: CategoryNameMap | null | undefined,
  locale: string,
  fallback: string
): string {
  if (name && typeof name === 'object') {
    const value = name[locale as keyof CategoryNameMap];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return fallback;
}
