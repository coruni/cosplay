import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NSFW_COOKIE, NSFW_COOKIE_MAX_AGE } from '@/lib/nsfw-shared';

/**
 * Mirror the NSFW preference into the request cookie. The server reads this
 * cookie (via `getShowNsfwServer`) to decide whether to fetch NSFW rows from
 * the DB, so it MUST be kept in sync with the client store — otherwise toggling
 * NSFW on the client has no effect on server-rendered gallery lists.
 */
function setNsfwCookie(value: boolean) {
  if (typeof document === 'undefined') return;
  if (value) {
    document.cookie = `${NSFW_COOKIE}=1; path=/; max-age=${NSFW_COOKIE_MAX_AGE}; samesite=lax`;
  } else {
    document.cookie = `${NSFW_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
}

interface NsfwState {
  showNsfw: boolean;
  ageConfirmed: boolean;
  setShowNsfw: (value: boolean) => void;
  confirmAge: () => void;
  resetAgeConfirmation: () => void;
}

export const useNsfwStore = create<NsfwState>()(
  persist(
    (set) => ({
      showNsfw: false,
      ageConfirmed: false,
      setShowNsfw: (value) => {
        setNsfwCookie(value);
        set({ showNsfw: value });
      },
      confirmAge: () => {
        setNsfwCookie(true);
        set({ ageConfirmed: true, showNsfw: true });
      },
      resetAgeConfirmation: () => {
        setNsfwCookie(false);
        set({ ageConfirmed: false, showNsfw: false });
      },
    }),
    {
      name: 'coshub-nsfw-prefs',
      partialize: (state) => ({
        showNsfw: state.showNsfw,
        ageConfirmed: state.ageConfirmed,
      }),
    }
  )
);
