import Redis from "ioredis";
import { env } from "../../config/env";
import { logger } from "../logger";

// Single Redis client reused for cache, playback hot-state, queue state,
// idempotency and rate limiting (sections 6, 11, 12).
export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 2,
  connectTimeout: 3000,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});

redis.on("error", (err) => logger.error({ err }, "redis_error"));
redis.on("connect", () => logger.info("redis_connected"));
