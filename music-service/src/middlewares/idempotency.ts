import type { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from '../utils/logger';
import config from '../config/config';
import { redisClient } from '../infra/redis';
import { CACHE_KEYS } from '../constants/cache.constants';
import { IDEMPOTENCY_HEADER, IDEMPOTENCY_MAX_KEY_LENGTH } from '../constants/http.constants';
import { createAppError, COMMON_ERRORS } from '../errors';

export interface IdempotencyOptions {
  scope: string;
  required?: boolean;
  ttlSeconds?: number;
}

export function idempotency(options: IdempotencyOptions): RequestHandler {
  const ttlSeconds = options.ttlSeconds ?? config.IDEMPOTENCY_TTL_SECONDS;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawKey = req.headers[IDEMPOTENCY_HEADER];
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';

    if (!key) {
      if (options.required) {
        next(createAppError(
          { code: 'IDEMPOTENCY_KEY_REQUIRED', message: `${IDEMPOTENCY_HEADER} header is required`, statusCode: 400 },
          { scope: options.scope },
        ));
        return;
      }
      next();
      return;
    }

    if (key.length > IDEMPOTENCY_MAX_KEY_LENGTH) {
      next(createAppError(
        { code: 'IDEMPOTENCY_KEY_INVALID', message: `${IDEMPOTENCY_HEADER} is too long`, statusCode: 400 },
        { scope: options.scope },
      ));
      return;
    }

    const actor = req.actor;
    const actorId = actor?.isAdmin ? actor.teamId : actor?.userId ?? req.user?.userId ?? 'anonymous';
    const reservationKey = CACHE_KEYS.idempotency(actorId ?? 'anonymous', options.scope, key);
    res.locals.idempotencyKey = key;

    let reserved = false;
    try {
      const result = await redisClient.set(reservationKey, '1', { NX: true, EX: ttlSeconds });
      reserved = result === 'OK';
      if (!reserved) {
        next(createAppError(COMMON_ERRORS.DUPLICATE_REQUEST, { scope: options.scope, idempotencyKey: key }));
        return;
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, scope: options.scope }, 'idempotency reservation unavailable, relying on the database constraint');
      next();
      return;
    }

    res.on('finish', () => {
      if (!reserved || res.statusCode < 400) return;
      void redisClient.del(reservationKey).catch((err: any) => {
        logger.warn({ err: err?.message, scope: options.scope }, 'failed to release idempotency reservation');
      });
    });
    next();
  };
}

export function idempotencyKeyOf(res: Response): string | null {
  return (res.locals.idempotencyKey as string | undefined) ?? null;
}

// Compatibility helper for existing service methods.
export async function withIdempotency<T>(
  scope: string,
  userId: string,
  req: Request,
  operation: () => Promise<T>,
): Promise<T> {
  const key = req.headers[IDEMPOTENCY_HEADER];
  if (typeof key !== 'string' || key.trim().length === 0) return operation();

  const redisKey = CACHE_KEYS.idempotency(userId, scope, key.trim());
  const existing = await redisClient.get(redisKey);
  if (existing && existing !== '1') return JSON.parse(existing) as T;
  if (existing === '1') throw createAppError(COMMON_ERRORS.DUPLICATE_REQUEST, { scope, idempotencyKey: key });

  const acquired = await redisClient.set(redisKey, '1', { NX: true, EX: config.IDEMPOTENCY_TTL_SECONDS });
  if (acquired !== 'OK') throw createAppError(COMMON_ERRORS.DUPLICATE_REQUEST, { scope, idempotencyKey: key });

  try {
    const result = await operation();
    await redisClient.set(redisKey, JSON.stringify(result), { EX: config.IDEMPOTENCY_TTL_SECONDS });
    return result;
  } catch (err) {
    await redisClient.del(redisKey);
    throw err;
  }
}

export default idempotency;
