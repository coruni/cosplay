/**
 * Shared NSFW preference constants — safe for BOTH server and client bundles.
 * (No `next/headers` import here, so client components can import it freely.)
 */

/** Cookie name storing the NSFW visibility preference ('1' = show NSFW). */
export const NSFW_COOKIE = 'coshub-nsfw';

/** One year, in seconds — used as the cookie Max-Age. */
export const NSFW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
