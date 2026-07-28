import Redis from 'ioredis';

const globalForCache = globalThis as unknown as {
  __redisClient?: Redis;
  __memCache?: MemoryCache;
  __cacheUseMemory?: boolean;
  __cacheWarned?: boolean;
  __cacheReconnectTimer?: ReturnType<typeof setTimeout> | null;
};

// ---------------------------------------------------------------------------
// In-memory fallback cache — used whenever Redis is unreachable.
// Lives on globalThis so it survives dev HMR and is shared per process.
// ---------------------------------------------------------------------------
interface MemEntry {
  value: string;
  expires: number; // epoch ms; 0 = never expires
}

class MemoryCache {
  private store = new Map<string, MemEntry>();

  get(key: string): string | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expires && Date.now() > e.expires) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }

  set(key: string, value: string, ttlSeconds?: number): void {
    const expires = ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0;
    this.store.set(key, { value, expires });
  }

  deleteKeys(keys: string[]): void {
    for (const k of keys) this.store.delete(k);
  }

  deletePattern(pattern: string): void {
    const re = globToRegExp(pattern);
    for (const k of Array.from(this.store.keys())) {
      if (re.test(k)) this.store.delete(k);
    }
  }
}

// Convert a Redis glob pattern (only '*' wildcards are used here) into a RegExp.
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function getMemoryCache(): MemoryCache {
  if (!globalForCache.__memCache) globalForCache.__memCache = new MemoryCache();
  return globalForCache.__memCache;
}

// ---------------------------------------------------------------------------
// Redis client — lazy connect, silently falls back to memory on failure.
// ---------------------------------------------------------------------------
function createRedisClient(): Redis {
  if (globalForCache.__redisClient) return globalForCache.__redisClient;

  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    retryStrategy(times) {
      // Stop ioredis' own reconnect loop after a few tries; recovery is
      // handled separately by scheduleRedisRecovery so we don't flap.
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
    connectTimeout: 3000,
  });

  // Connection-level errors: drop to memory immediately so we stop hammering
  // a dead server on every request.
  client.on('error', (err) => {
    markMemoryFallback(err);
  });

  // Kick off the connection; failure -> memory mode.
  client.connect().catch((err) => {
    markMemoryFallback(err);
  });

  globalForCache.__redisClient = client;
  return client;
}

function getRedisClient(): Redis {
  if (!globalForCache.__redisClient) createRedisClient();
  return globalForCache.__redisClient!;
}

function isMemoryMode(): boolean {
  return globalForCache.__cacheUseMemory === true;
}

function markMemoryFallback(err: unknown): void {
  if (!globalForCache.__cacheWarned) {
    globalForCache.__cacheWarned = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[Redis] 连接失败，已回退到内存缓存（仅当前进程有效）:', msg);
  }
  globalForCache.__cacheUseMemory = true;
  scheduleRedisRecovery();
}

// If Redis ever comes back, transparently restore it (no restart needed).
function scheduleRedisRecovery(): void {
  if (globalForCache.__cacheReconnectTimer) return;
  globalForCache.__cacheReconnectTimer = setTimeout(async () => {
    globalForCache.__cacheReconnectTimer = null;
    if (!isMemoryMode()) return;

    const client = getRedisClient();
    // Only attempt when the socket is actually dead; otherwise let ioredis
    // finish what it is doing and we'll check again later.
    if (client.status !== 'end' && client.status !== 'close') {
      scheduleRedisRecovery();
      return;
    }
    try {
      await client.connect();
      globalForCache.__cacheUseMemory = false;
      globalForCache.__cacheWarned = false;
      console.warn('[Redis] 已恢复连接，重新启用 Redis 缓存。');
    } catch {
      scheduleRedisRecovery();
    }
  }, 30_000);
}

export const redis = getRedisClient();

// ---------------------------------------------------------------------------
// Public cache helpers — identical signatures; Redis or memory, transparent.
// ---------------------------------------------------------------------------
const CACHE_TTL = {
  FEATURED: 300,        // 5 min
  GALLERY_LIST: 120,    // 2 min
  GALLERY_DETAIL: 600,  // 10 min
  CATEGORIES: 1800,     // 30 min
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (isMemoryMode()) {
    const raw = getMemoryCache().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  try {
    const data = await getRedisClient().get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch (err) {
    markMemoryFallback(err);
    const raw = getMemoryCache().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl?: number): Promise<void> {
  const data = JSON.stringify(value);
  if (isMemoryMode()) {
    getMemoryCache().set(key, data, ttl);
    return;
  }
  try {
    const client = getRedisClient();
    if (ttl) {
      await client.setex(key, ttl, data);
    } else {
      await client.set(key, data);
    }
  } catch (err) {
    markMemoryFallback(err);
    getMemoryCache().set(key, data, ttl);
  }
}

export async function cacheDelete(pattern: string): Promise<void> {
  if (isMemoryMode()) {
    getMemoryCache().deletePattern(pattern);
    return;
  }
  try {
    const client = getRedisClient();
    // SCAN (cursor-based, non-blocking) instead of KEYS (O(N) blocking).
    let cursor = '0';
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) await client.del(...keys);
    } while (cursor !== '0');
  } catch (err) {
    markMemoryFallback(err);
    getMemoryCache().deletePattern(pattern);
  }
}

export { CACHE_TTL };
