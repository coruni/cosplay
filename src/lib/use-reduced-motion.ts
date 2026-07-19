'use client';

import { useEffect, useState } from 'react';

/**
 * Hydration-safe replacement for framer-motion's `useReducedMotion`.
 *
 * Why this exists:
 * framer-motion's stock `useReducedMotion` reads
 * `window.matchMedia('(prefers-reduced-motion: reduce)')` synchronously and stores
 * the result in a module-level singleton. During SSR there is no `window`, so the
 * value is `false`; but on the client the singleton is populated *before* React
 * renders the first time, so the very first client render already returns `true`
 * when the device has Reduced Motion enabled. That makes `motion.*` elements emit
 * different inline `style`/`transform` attributes on the server vs the client and
 * triggers a React hydration mismatch ("some attributes of the server rendered
 * HTML didn't match the client properties").
 *
 * This hook always returns `false` for the first render (matching SSR) and only
 * switches to the real preference inside an effect — i.e. after hydration is done.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
