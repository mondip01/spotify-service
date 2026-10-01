import { redisClient, key as namespacedKey, withCommandTimeout, type RedisClient } from '../infra/redis';
import logger from '../utils/logger';
/**
 * Thin, typed wrapper over Redis with one firm rule: **a cache failure is never
 * a request failure.** Reads degrade to a miss and writes degrade to a no-op,
 * both logged. The alternative — propagating Redis errors — turns a cache outage
 * into a full outage, which is strictly worse than serving from Mongo slowly.
 *
 * The one exception is acquire-style operations in lockService, where a failure
 * genuinely must surface: silently failing to take a lock would let two callers
 * both believe they hold it.
 */
/** One entry for {@link CacheService.setMany}. */
export interface CacheEntry {
  cacheKey: string;
  value: unknown;
  ttlSeconds: number;
}
export interface CacheService {
  get<T>(cacheKey: string): Promise<T | null>;
  /**
   * Many keys in one round trip, **index-aligned with cacheKeys** — a null at
   * position i means key i was a miss.
   *
   * The alignment is the contract, so it holds in every case including an
   * unavailable Redis: callers pair the result with their own id list by
   * position, and a short array would silently shift every entry after a miss.
   */
  getMany<T>(cacheKeys: string[]): Promise<(T | null)[]>;
  set(cacheKey: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** Many writes in one round trip. Per-entry TTLs, since they rarely agree. */
  setMany(entries: CacheEntry[]): Promise<void>;
  del(...cacheKeys: string[]): Promise<void>;
  /** Deletes by pattern. Uses SCAN, never KEYS, which blocks the server. */
  delByPattern(pattern: string): Promise<number>;
  addToSet(cacheKey: string, members: string[], ttlSeconds: number): Promise<void>;
  getSet(cacheKey: string): Promise<string[] | null>;
  isSetMember(cacheKey: string, member: string): Promise<boolean>;
  incr(cacheKey: string, ttlSeconds: number): Promise<number | null>;
  exists(cacheKey: string): Promise<boolean>;
    // NEW HASH METHODS
  hIncrBy(cacheKey: string, field: string, increment: number): Promise<number | null>;
  hGet(cacheKey: string, field: string): Promise<string | null>;
  hGetAll(cacheKey: string): Promise<Record<string, string> | null>;
  hDel(cacheKey: string, fields: string[]): Promise<number | null>;
}
export function createCacheService(client: RedisClient): CacheService {
  /** Redis is unusable while reconnecting; skip rather than queue commands. */
  function unavailable(): boolean {
    return !client.isReady;
  }
  /**
   * Every command goes through here, so none can outlive its deadline.
   *
   * A timeout surfaces as a rejection and is caught by the same handler as any
   * other Redis error — which is what keeps the module's promise intact: a cache
   * failure, slow or fast, is never a request failure.
   */
  function run<T>(operation: Promise<T>, label: string): Promise<T> {
    return withCommandTimeout(operation, label);
  }
  async function get<T>(cacheKey: string): Promise<T | null> {
    if (unavailable()) return null;
    try {
      const raw = await run(client.get(cacheKey), 'get');
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err: any) {
      // A corrupt entry is treated as a miss and evicted, so one bad write
      // cannot poison a key until its TTL elapses.
      logger.warn({ err: err?.message, cacheKey }, 'cache read failed, treating as miss');
      void client.del(cacheKey).catch(() => undefined);
      return null;
    }
  }
  /**
   * MGET, for the read shape this service actually has: a page of twenty author
   * cards, a comment thread's sixty ids, a subscription set intersection.
   *
   * The loop it replaces was not wrong — node-redis batches same-tick commands
   * into one socket write, so the round trip was already close to one. What did
   * not batch away is **command count**: Redis is single-threaded, so twenty
   * GETs are twenty things it parses and executes in series, ahead of every
   * other client's work on a shared instance. One MGET is one of each.
   *
   * A corrupt entry is isolated rather than failing the batch — it becomes a
   * miss and is evicted, exactly as in get, so one bad write cannot cost a
   * whole feed page its cards.
   */
  async function getMany<T>(cacheKeys: string[]): Promise<(T | null)[]> {
    if (cacheKeys.length === 0) return [];
    // Index-aligned even here: callers read this by position.
    if (unavailable()) return cacheKeys.map(() => null);
    let raw: (string | null)[];
    try {
      raw = await run(client.mGet(cacheKeys), 'mGet');
    } catch (err: any) {
      logger.warn({ err: err?.message, keys: cacheKeys.length }, 'cache multi-read failed, treating as misses');
      return cacheKeys.map(() => null);
    }
    return raw.map((entry, index) => {
      if (entry === null || entry === undefined) return null;
      try {
        return JSON.parse(entry) as T;
      } catch (err: any) {
        const cacheKey = cacheKeys[index] as string;
        logger.warn({ err: err?.message, cacheKey }, 'cache entry unparseable, treating as miss');
        void client.del(cacheKey).catch(() => undefined);
        return null;
      }
    });
  }
  async function set(cacheKey: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (unavailable()) return;
    try {
      await run(client.set(cacheKey, JSON.stringify(value), { EX: ttlSeconds }), 'set');
    } catch (err: any) {
      logger.warn({ err: err?.message, cacheKey }, 'cache write failed');
    }
  }
  /**
   * Many writes as one MULTI.
   *
   * Not for atomicity — cache entries have no invariant between them, and a
   * partial write is merely a partial cache. It is for the same reason as
   * getMany: one command exchange instead of N, on the path that populates a
   * cold page.
   *
   * Values are serialized before the pipeline is built, so a value that cannot
   * be stringified fails here rather than mid-transaction.
   */
  async function setMany(entries: CacheEntry[]): Promise<void> {
    if (unavailable() || entries.length === 0) return;
    try {
      const pipeline = client.multi();
      for (const entry of entries) {
        pipeline.set(entry.cacheKey, JSON.stringify(entry.value), { EX: entry.ttlSeconds });
      }
      await run(pipeline.exec(), 'multiSet');
    } catch (err: any) {
      logger.warn({ err: err?.message, entries: entries.length }, 'cache multi-write failed');
    }
  }
  async function del(...cacheKeys: string[]): Promise<void> {
    if (unavailable() || cacheKeys.length === 0) return;
    try {
      await run(client.del(cacheKeys), 'del');
    } catch (err: any) {
      logger.warn({ err: err?.message, cacheKeys }, 'cache delete failed');
    }
  }
  async function delByPattern(pattern: string): Promise<number> {
    if (unavailable()) return 0;
    let removed = 0;
    try {
      // SCAN in batches. KEYS would block Redis for the whole sweep, which on a
      // shared instance stalls every other service on the platform.
      for await (const batch of client.scanIterator({ MATCH: pattern, COUNT: 200 })) {
        const keys = Array.isArray(batch) ? batch : [batch];
        if (keys.length === 0) continue;
        removed += await run(client.del(keys), 'del');
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, pattern }, 'cache pattern delete failed');
    }
    return removed;
  }
  async function addToSet(cacheKey: string, members: string[], ttlSeconds: number): Promise<void> {
    if (unavailable() || members.length === 0) return;
    try {
      await run(client.sAdd(cacheKey, members), 'sAdd');
      await run(client.expire(cacheKey, ttlSeconds), 'expire');
    } catch (err: any) {
      logger.warn({ err: err?.message, cacheKey }, 'cache set-add failed');
    }
  }
  /** Null means "not cached"; an empty array means "cached, and genuinely empty". */
  async function getSet(cacheKey: string): Promise<string[] | null> {
    if (unavailable()) return null;
    try {
      const exists = await run(client.exists(cacheKey), 'exists');
      if (exists === 0) return null;
      return await run(client.sMembers(cacheKey), 'sMembers');
    } catch (err: any) {
      logger.warn({ err: err?.message, cacheKey }, 'cache set-read failed');
      return null;
    }
  }
  async function isSetMember(cacheKey: string, member: string): Promise<boolean> {
    if (unavailable()) return false;
    try {
      return await run(client.sIsMember(cacheKey, member), 'sIsMember');
    } catch (err: any) {
      logger.warn({ err: err?.message, cacheKey }, 'cache set-member check failed');
      return false;
    }
  }
  /**
   * Increments a counter, setting the TTL only on the first hit so the window is
   * fixed rather than sliding. Returns null when Redis is unavailable, which
   * callers must treat as "cannot determine" rather than "zero".
   */
  async function incr(cacheKey: string, ttlSeconds: number): Promise<number | null> {
    if (unavailable()) return null;
    try {
      const count = await run(client.incr(cacheKey), 'incr');
      if (count === 1) await run(client.expire(cacheKey, ttlSeconds), 'expire');
      return count;
    } catch (err: any) {
      logger.warn({ err: err?.message, cacheKey }, 'cache incr failed');
      return null;
    }
  }
  async function exists(cacheKey: string): Promise<boolean> {
    if (unavailable()) return false;
    try {
      return (await run(client.exists(cacheKey), 'exists')) > 0;
    } catch (err: any) {
      logger.warn({ err: err?.message, cacheKey }, 'cache exists check failed');
      return false;
    }
  }
   async function hIncrBy(cacheKey: string, field: string, increment: number): Promise<number | null> {
    if (unavailable()) return null;
    try {
      return await run(client.hIncrBy(cacheKey, field, increment), 'hIncrBy');
    } catch (err: any) {
      logger.warn({ err: err?.message, cacheKey, field }, 'cache hIncrBy failed');
      return null;
    }
  }
  async function hGet(cacheKey: string, field: string): Promise<string | null> {
    if (unavailable()) return null;
    try {
        const result = await run(client.hGet(cacheKey, field), 'hGet');
        return result ?? null; 
    } catch (err: any) {
      logger.warn({ err: err?.message, cacheKey, field }, 'cache hGet failed');
      return null;
    }
  }
  async function hGetAll(cacheKey: string): Promise<Record<string, string> | null> {
    if (unavailable()) return null;
    try {
      return await run(client.hGetAll(cacheKey), 'hGetAll');
    } catch (err: any) {
      logger.warn({ err: err?.message, cacheKey }, 'cache hGetAll failed');
      return null;
    }
  }
  async function hDel(cacheKey: string, fields: string[]): Promise<number | null> {
    if (unavailable() || fields.length === 0) return null;
    try {
      return await run(client.hDel(cacheKey, fields), 'hDel');
    } catch (err: any) {
      logger.warn({ err: err?.message, cacheKey, fields }, 'cache hDel failed');
      return null;
    }
  }
  return { get, getMany, set, setMany, del, delByPattern, addToSet, getSet, isSetMember, incr, exists,  hIncrBy, hGet, hGetAll, hDel };
}
export const cacheService = createCacheService(redisClient);
export { namespacedKey as cacheKey };
