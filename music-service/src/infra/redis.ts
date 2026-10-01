import { createClient, type RedisClientType } from 'redis';
import { env } from '../config/env';
import logger from '../utils/logger';

export type RedisClient = RedisClientType;

export const redisClient: RedisClient = createClient({ url: env.redisUrl });
export const redis = redisClient;

redisClient.on('error', (err) => logger.error({ err }, 'redis client error'));
redisClient.on('connect', () => logger.info('redis connected'));
redisClient.on('ready', () => logger.info('redis ready'));
redisClient.on('reconnecting', () => logger.warn('redis reconnecting'));

void redisClient.connect().catch((err) => {
  logger.error({ err }, 'redis initial connection failed');
});

export function key(...parts: string[]): string {
  return ['music', ...parts].join(':');
}

export function withCommandTimeout<T>(operation: Promise<T>, label: string, timeoutMs = 1500): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Redis command ${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    timer.unref();
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient.isOpen) await redisClient.quit();
}

export function isRedisReady(): boolean {
  return redisClient.isReady;
}
