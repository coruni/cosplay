import { create } from 'zustand';

/**
 * Lets a route tell the global `Header` whether it owns a "hero" cover image
 * that should show *through* a transparent header at the top of the page.
 *
 * - `transparentAtTop = true`  → header is transparent while at the top of the
 *   page (revealing the cover) and turns solid once the user scrolls down.
 * - `transparentAtTop = false` → header is always solid (e.g. pages without a
 *   cover image, or non-detail pages).
 *
 * The gallery detail route sets this from its `gallery.cover` and resets it on
 * unmount, so only the detail page with a cover gets the transparent treatment.
 */
interface HeaderState {
  transparentAtTop: boolean;
  setTransparentAtTop: (value: boolean) => void;
}

export const useHeaderStore = create<HeaderState>((set) => ({
  transparentAtTop: false,
  setTransparentAtTop: (value) => set({ transparentAtTop: value }),
}));
