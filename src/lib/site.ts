import { headers } from 'next/headers';

/**
 * Resolve the canonical site origin for SEO output (sitemap, robots, metadataBase).
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL env  — set this in production (no trailing slash).
 *   2. Request host (x-forwarded-host / host) — works at request time behind a
 *      reverse proxy that forwards the original host.
 *   3. localhost:3000 — dev / static build fallback.
 *
 * Centralizing this avoids the hardcoded placeholder domain that previously leaked
 * into robots.txt / sitemap.xml.
 */
export async function getSiteUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && env.trim()) {
    return env.trim().replace(/\/+$/, '');
  }

  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto = h.get('x-forwarded-proto') ?? 'https';
      return `${proto}://${host}`;
    }
  } catch {
    // headers() is only available inside a request context.
  }

  return 'http://localhost:3000';
}
