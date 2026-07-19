export interface CategoryMeta {
  /** Emoji or short glyph shown on the category card. */
  icon: string;
}

/**
 * Centralized category metadata. Icons live here once so the categories page
 * (and any future category UI) stay in sync. To add a new category icon, add a
 * single entry below — anything not listed falls back to DEFAULT_CATEGORY_ICON.
 *
 * Category labels are still resolved via the `categories` i18n namespace, so
 * this table only owns the visual icon.
 */
export const CATEGORY_META: Record<string, CategoryMeta> = {
  game: { icon: '🎮' },
  anime: { icon: '🎬' },
  manga: { icon: '📚' },
  movie: { icon: '🎥' },
  original: { icon: '✨' },
  swimsuit: { icon: '🏖️' },
  lingerie: { icon: '💋' },
  school: { icon: '🎒' },
  fantasy: { icon: '🧙' },
};

export const DEFAULT_CATEGORY_ICON = '📷';

export function getCategoryIcon(slug: string): string {
  return CATEGORY_META[slug]?.icon ?? DEFAULT_CATEGORY_ICON;
}
