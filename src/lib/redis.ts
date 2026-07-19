import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient() {
  if (!globalForRedis.redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    globalForRedis.redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
    });

    // Connect silently
    globalForRedis.redis.connect().catch((err) => {
      console.warn('[Redis] Connection failed, running without cache:', err.message);
    });
  }

  return globalForRedis.redis;
}

export const redis = createRedisClient();

// Cache helpers
const CACHE_TTL = {
  FEATURED: 300,        // 5 min
  GALLERY_LIST: 120,    // 2 min
  GALLERY_DETAIL: 600,  // 10 min
  CATEGORIES: 1800,     // 30 min
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl?: number): Promise<void> {
  try {
    const data = JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl, data);
    } else {
      await redis.set(key, data);
    }
  } catch {
    // Fail silently — cache is optional
  }
}

export async function cacheDelete(pattern: string): Promise<void> {
  try {
    // Use SCAN (cursor-based, non-blocking) instead of KEYS (O(N) blocking).
    // KEYS would freeze the Redis main thread on large keyspaces; SCAN walks
    // in batches of COUNT and yields between iterations.
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        200
      );
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // Fail silently — cache is optional
  }
}

export async function incrementViewCount(gallerySlug: string): Promise<number> {
  try {
    const key = `views:${gallerySlug}`;
    const count = await redis.incr(key);
    return count;
  } catch {
    return 0;
  }
}

export async function getViewCount(gallerySlug: string): Promise<number> {
  try {
    const count = await redis.get(`views:${gallerySlug}`);
    return count ? parseInt(count, 10) : 0;
  } catch {
    return 0;
  }
}

export { CACHE_TTL };
