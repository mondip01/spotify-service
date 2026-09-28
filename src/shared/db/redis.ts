import Redis from "ioredis";
import { config } from "@config/index";
import { logger } from "@shared/logger";

// Redis is an accelerator / hot-state store (Section 4). Its loss must never
// destroy essential user data - see shared/cache and playback module for the
// Mongo-fallback pattern this client enables.
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 2,
  connectTimeout: 3000,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});

redis.on("connect", () => logger.info("redis connected"));
redis.on("error", (err) => logger.error({ err }, "redis error"));

export async function safeRedisCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.warn({ err }, "redis call failed, using fallback");
    return fallback;
  }
}
