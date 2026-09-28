import { Request } from "express";
import { redis } from "../cache/redisClient";
import { AppError } from "../errors/AppError";

// Section 8 / 14: "Use Idempotency-Key on retry-prone mutations such as
// upload creation, downloads and subscriptions." music:idem:{scope}:{userId}:{key}
const IDEMPOTENCY_TTL_SEC = 60 * 30;

export function getIdempotencyKey(req: Request): string | null {
  const key = req.headers["idempotency-key"];
  return typeof key === "string" && key.length > 0 ? key : null;
}

/**
 * Wraps a mutation so that a repeated request with the same
 * Idempotency-Key returns the first response instead of repeating the
 * side effect. Store the key BEFORE running the operation (with a short
 * "in-flight" marker) to also guard against concurrent duplicate
 * requests racing each other.
 */
export async function withIdempotency<T>(
  scope: string,
  userId: string,
  req: Request,
  operation: () => Promise<T>
): Promise<T> {
  const key = getIdempotencyKey(req);
  if (!key) return operation(); // Idempotency-Key is optional on some routes.

  const redisKey = `music:idem:${scope}:${userId}:${key}`;
  const existing = await redis.get(redisKey);

  if (existing === "IN_PROGRESS") {
    throw AppError.conflict("IDEMPOTENCY_IN_PROGRESS", "An identical request is already being processed");
  }
  if (existing) {
    return JSON.parse(existing) as T;
  }

  const acquired = await redis.set(redisKey, "IN_PROGRESS", "EX", IDEMPOTENCY_TTL_SEC, "NX");
  if (!acquired) {
    // Lost the race to another concurrent identical request.
    throw AppError.conflict("IDEMPOTENCY_IN_PROGRESS", "An identical request is already being processed");
  }

  try {
    const result = await operation();
    await redis.set(redisKey, JSON.stringify(result), "EX", IDEMPOTENCY_TTL_SEC);
    return result;
  } catch (err) {
    await redis.del(redisKey); // allow retry after a genuine failure
    throw err;
  }
}
