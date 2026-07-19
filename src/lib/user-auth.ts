import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { prisma } from './db';
import type { SafeUser } from '@/types';
import type { User } from '@prisma/client';

const COOKIE_NAME = 'user_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getJwtSecret(): Uint8Array {
  const secret = process.env.USER_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('USER_JWT_SECRET must be set in production');
    }
    console.warn(
      '[user-auth] USER_JWT_SECRET not set, using dev fallback. Set it in production!'
    );
    return new TextEncoder().encode('dev-only-secret-change-me');
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signJWT(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

export async function verifyJWT(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function setUserCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export function clearUserCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function getTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    createdAt: user.createdAt.toISOString(),
    isSubscribed: user.isSubscribed,
    subscriptionEndAt: user.subscriptionEndAt
      ? user.subscriptionEndAt.toISOString()
      : null,
    quotaTotal: user.quotaTotal,
    quotaUsed: user.quotaUsed,
  };
}

/**
 * Get the current user from the request cookies.
 * Returns null if not authenticated or token invalid.
 * Use in API route handlers — caller decides how to handle null.
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = getTokenFromCookies(cookieStore.toString());
  if (!token) return null;

  const userId = await verifyJWT(token);
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  return toSafeUser(user);
}

/**
 * Require an authenticated user for a server component / page.
 * Redirects to /${locale}/login if not authenticated.
 * Use ONLY in page/layout server components — not in route handlers.
 */
export async function requireUserForPage(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (user) return user;
  const locale = await getLocale();
  redirect(`/${locale}/login`);
}

/**
 * Check if a user has purchased a specific gallery.
 * Returns true if a paid PaymentOrder exists for (userId, galleryId).
 */
export async function hasPurchasedGallery(
  userId: string | null | undefined,
  galleryId: string
): Promise<boolean> {
  if (!userId) return false;
  const order = await prisma.paymentOrder.findFirst({
    where: { userId, galleryId, status: 'paid' },
    select: { id: true },
  });
  return order !== null;
}
