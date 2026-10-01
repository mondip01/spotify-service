import { randomUUID } from 'node:crypto';
import { redisClient, withCommandTimeout } from '../infra/redis';
import logger from '../utils/logger';

export interface LockOptions {
  ttlSeconds: number;
  waitMs?: number;
  retryDelayMs?: number;
}

export interface LockHandle {
  key: string;
  token: string;
  release(): Promise<void>;
}

const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

export async function acquireLock(lockKey: string, options: LockOptions): Promise<LockHandle | null> {
  const waitMs = options.waitMs ?? 0;
  const retryDelayMs = options.retryDelayMs ?? 50;
  const token = randomUUID();
  const deadline = Date.now() + waitMs;

  do {
    try {
      const result = await withCommandTimeout(
        redisClient.set(lockKey, token, { NX: true, EX: options.ttlSeconds }),
        'lock.acquire',
      );
      if (result === 'OK') {
        return {
          key: lockKey,
          token,
          release: async () => {
            try {
              await withCommandTimeout(redisClient.eval(RELEASE_SCRIPT, { keys: [lockKey], arguments: [token] }), 'lock.release');
            } catch (err: any) {
              logger.error({ err: err?.message, lockKey }, 'lock release failed');
              throw err;
            }
          },
        };
      }
    } catch (err) {
      // Unlike cache operations, lock acquisition cannot fail open.
      logger.error({ err, lockKey }, 'lock acquisition failed');
      throw err;
    }

    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(retryDelayMs, Math.max(1, deadline - Date.now()))));
  } while (Date.now() <= deadline);

  return null;
}

export async function withLock<T>(lockKey: string, options: LockOptions, operation: () => Promise<T>): Promise<T> {
  const lock = await acquireLock(lockKey, options);
  if (!lock) throw new Error(`Could not acquire lock: ${lockKey}`);
  try {
    return await operation();
  } finally {
    await lock.release();
  }
}
