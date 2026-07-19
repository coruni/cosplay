import crypto from 'crypto';

const DEFAULT_TOKEN = 'coshub-admin-2025';

export function getAdminToken(): string {
  const env = process.env.ADMIN_TOKEN;
  if (!env) {
    if (process.env.NODE_ENV === 'production') {
      // Refuse to boot in production with the hardcoded default — any
      // operator who forgets to set ADMIN_TOKEN would otherwise ship a
      // publicly known admin credential. Mirror the getJwtSecret pattern
      // in user-auth.ts.
      throw new Error(
        'ADMIN_TOKEN must be set in production. Refusing to fall back to default token.'
      );
    }
    return DEFAULT_TOKEN;
  }
  return env;
}

export function validateToken(token: string): boolean {
  const valid = getAdminToken();
  // Compare SHA-256 digests so buffer lengths are always equal (32 bytes).
  // Avoids the previous catch-branch fallback to `===`, which leaked token
  // length via timing when `timingSafeEqual` threw on unequal buffer lengths.
  const a = crypto.createHash('sha256').update(token).digest();
  const b = crypto.createHash('sha256').update(valid).digest();
  return crypto.timingSafeEqual(a, b);
}

export function getTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/admin_token=([^;]+)/);
  return match ? match[1] : null;
}

export function setAuthCookie(token: string): string {
  return `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

export function clearAuthCookie(): string {
  return 'admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}
