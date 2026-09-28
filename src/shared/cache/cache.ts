import { redis } from "./redisClient";
import { logger } from "../logger";

// Generic cache-aside helper used by catalog/home/search (section 12
// key design: music:track:*, music:home:*, music:search:*).
// Redis being down must NEVER fail a read - it just means a cache miss,
// per section 22 ("noncritical cache misses continue").
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    logger.warn({ err, key }, "cache_get_failed_soft");
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch (err) {
    logger.warn({ err, key }, "cache_set_failed_soft");
  }
}

export async function cacheDel(key: string | string[]): Promise<void> {
  try {
    await redis.del(...(Array.isArray(key) ? key : [key]));
  } catch (err) {
    logger.warn({ err, key }, "cache_del_failed_soft");
  }
}

export async function withCache<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const fresh = await loader();
  await cacheSet(key, fresh, ttlSec);
  return fresh;
}
