import { NextFunction, Request, Response } from "express";
import { redis } from "../infra/redis";
import { AppError } from "../errors/AppError";
import { logger } from "../utils/logger";

// Section 12 key design: music:rate:{scope}:{userId}. Fixed-window
// counter - simple, cheap, good enough for route-level protection.
// Also implements the PRD's free-tier "3 plays/day" rule via a
// midnight-aligned window when scope === "playback:free-tier".
export function rateLimit(scope: string, maxRequests: number, windowSec: number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const identity = req.user?.userId ?? req.ip ?? "anonymous";
    const key = `music:rate:${scope}:${identity}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSec);
      }
      if (count > maxRequests) {
        throw AppError.tooManyRequests(`Rate limit exceeded for ${scope}`);
      }
      next();
    } catch (err) {
      if (err instanceof AppError) return next(err);
      // Redis outage should not take down the whole API - fail open with a log.
      logger.warn({ err, scope }, "rate_limit_check_failed_open");
      next();
    }
  };
}

/** Free-tier daily play cap, windowed to end of the current day (IST-naive UTC day for simplicity). */
export async function checkFreeTierDailyLimit(userId: string, limit: number): Promise<{ remaining: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `music:rate:playback:free-tier:${userId}:${today}`;

  const count = await redis.incr(key);
  if (count === 1) {
    const secondsUntilMidnightUtc = 86400 - (Date.now() % 86400000) / 1000;
    await redis.expire(key, Math.ceil(secondsUntilMidnightUtc));
  }
  if (count > limit) {
    throw new AppError(403, "FREE_TIER_LIMIT_REACHED", "Free tier daily play limit reached");
  }
  return { remaining: Math.max(0, limit - count) };
}
