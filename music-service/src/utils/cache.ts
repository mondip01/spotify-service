export { cacheService, cacheKey, createCacheService } from '../services/cacheService';
export type { CacheService, CacheEntry } from '../services/cacheService';

import { cacheService } from '../services/cacheService';

export async function cacheGet<T>(key: string): Promise<T | null> {
  return cacheService.get<T>(key);
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  await cacheService.set(key, value, ttlSec);
}

export async function cacheDel(key: string | string[]): Promise<void> {
  await cacheService.del(...(Array.isArray(key) ? key : [key]));
}

export async function withCache<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
  const cached = await cacheService.get<T>(key);
  if (cached !== null) return cached;
  const fresh = await loader();
  await cacheService.set(key, fresh, ttlSec);
  return fresh;
}
