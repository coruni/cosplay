import { Prisma } from '@prisma/client';
import { prisma } from './db';

/** Quota reset cycle length in ms (default 30 days, configurable). */
const CYCLE_MS =
  (Number(process.env.SUBSCRIPTION_CYCLE_DAYS) || 30) * 24 * 60 * 60 * 1000;

/** Monthly quota (unlock + download combined). Default 120. */
const DEFAULT_QUOTA = Number(process.env.SUBSCRIPTION_QUOTA) || 120;

export interface SubscriptionStatus {
  isSubscribed: boolean;
  /** subscribed AND not past membership expiry */
  isActive: boolean;
  quotaTotal: number;
  quotaUsed: number;
  quotaRemaining: number;
  currentCycle: number;
  /** start of the current 30-day quota cycle */
  cycleStartAt: string;
  /** end of the current cycle (next reset point) */
  cycleEndAt: string;
  /** membership expiry (end of paid period) */
  subscriptionEndAt: string | null;
}

function emptyStatus(): SubscriptionStatus {
  const now = Date.now();
  return {
    isSubscribed: false,
    isActive: false,
    quotaTotal: DEFAULT_QUOTA,
    quotaUsed: 0,
    quotaRemaining: DEFAULT_QUOTA,
    currentCycle: 0,
    cycleStartAt: new Date(now).toISOString(),
    cycleEndAt: new Date(now + CYCLE_MS).toISOString(),
    subscriptionEndAt: null,
  };
}

/**
 * Compute the current cycle index relative to subscriptionStartAt.
 * Cycles advance every CYCLE_MS; quota resets at each boundary.
 */
function cycleIndex(startAt: Date | null, now: number): number {
  if (!startAt) return 0;
  return Math.floor((now - startAt.getTime()) / CYCLE_MS);
}

/**
 * Get the current subscription status for a user.
 * Performs a lazy quota reset if the 30-day cycle has advanced.
 */
export async function getSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatus> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.subscriptionStartAt) return emptyStatus();

  const now = Date.now();
  const currentCycle = cycleIndex(user.subscriptionStartAt, now);
  const active =
    user.isSubscribed &&
    !!user.subscriptionEndAt &&
    user.subscriptionEndAt.getTime() > now;

  let quotaUsed = user.quotaUsed;
  // Lazy reset: if we've rolled into a new cycle, zero the used counter.
  if (currentCycle > user.quotaCycle) {
    await prisma.user.update({
      where: { id: userId },
      data: { quotaUsed: 0, quotaCycle: currentCycle },
    });
    quotaUsed = 0;
  }

  const quotaTotal = user.quotaTotal || DEFAULT_QUOTA;
  const cycleStartMs = user.subscriptionStartAt.getTime() + user.quotaCycle * CYCLE_MS;

  return {
    isSubscribed: !!user.isSubscribed,
    isActive: !!active,
    quotaTotal,
    quotaUsed,
    quotaRemaining: Math.max(0, quotaTotal - quotaUsed),
    currentCycle,
    cycleStartAt: new Date(cycleStartMs).toISOString(),
    cycleEndAt: new Date(cycleStartMs + CYCLE_MS).toISOString(),
    subscriptionEndAt: user.subscriptionEndAt
      ? user.subscriptionEndAt.toISOString()
      : null,
  };
}

export interface ConsumeResult {
  ok: boolean;
  remaining: number;
  reason?: 'inactive' | 'exhausted' | 'no_user';
}

/**
 * Atomically consume 1 unit of monthly quota (unlock or download).
 * - Returns { ok:false, reason:'inactive' } if not an active subscriber.
 * - Returns { ok:false, reason:'exhausted' } if quota used up this cycle.
 * - Otherwise increments quotaUsed and returns remaining count.
 * Auto-resets quota when a new cycle boundary is crossed.
 *
 * This is the transaction-client version: it runs inside a caller-supplied
 * `tx` and does NOT create its own `$transaction`. Use this when you need
 * to combine quota consumption with other writes in a single atomic unit
 * (e.g. the unlock route records a payment order + bumps downloadCount).
 */
export async function consumeQuotaTx(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<ConsumeResult> {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, remaining: 0, reason: 'no_user' as const };

  const now = Date.now();
  const active =
    user.isSubscribed &&
    !!user.subscriptionEndAt &&
    user.subscriptionEndAt.getTime() > now;
  if (!active) {
    return { ok: false, remaining: 0, reason: 'inactive' as const };
  }

  const currentCycle = cycleIndex(user.subscriptionStartAt, now);
  let quotaUsed = user.quotaUsed;
  const quotaTotal = user.quotaTotal || DEFAULT_QUOTA;

  // Reset at cycle boundary
  if (currentCycle > user.quotaCycle) {
    quotaUsed = 0;
    await tx.user.update({
      where: { id: userId },
      data: { quotaUsed: 0, quotaCycle: currentCycle },
    });
  }

  if (quotaUsed >= quotaTotal) {
    return { ok: false, remaining: 0, reason: 'exhausted' as const };
  }

  await tx.user.update({
    where: { id: userId },
    data: { quotaUsed: { increment: 1 } },
  });

  return { ok: true, remaining: quotaTotal - quotaUsed - 1 };
}

/**
 * Standalone wrapper around `consumeQuotaTx` for callers that don't need
 * to share a transaction. Equivalent to the pre-refactor `consumeQuota`.
 */
export async function consumeQuota(userId: string): Promise<ConsumeResult> {
  return prisma.$transaction((tx) => consumeQuotaTx(tx, userId));
}

/**
 * Activate (or renew) a subscription for 30 days from now.
 * Resets quota and cycle. Used by payment success (mock + real notify).
 */
export async function activateSubscription(userId: string): Promise<void> {
  const now = new Date();
  const end = new Date(now.getTime() + CYCLE_MS);
  await prisma.user.update({
    where: { id: userId },
    data: {
      isSubscribed: true,
      subscriptionStartAt: now,
      subscriptionEndAt: end,
      quotaTotal: DEFAULT_QUOTA,
      quotaUsed: 0,
      quotaCycle: 0,
    },
  });
}
