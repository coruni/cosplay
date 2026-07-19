import crypto from 'crypto';

const DEFAULT_TOKEN = 'coshub-admin-2025';

export function getAdminToken(): string {
  return process.env.ADMIN_TOKEN || DEFAULT_TOKEN;
}

export function validateToken(token: string): boolean {
  const valid = getAdminToken();
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(valid)
    );
  } catch {
    return token === valid;
  }
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
