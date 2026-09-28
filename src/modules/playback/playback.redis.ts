import { redis } from "../../shared/cache/redisClient";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";

// Section 11/12: Redis is the primary live store for queue + hot
// playback position. Key shapes are exactly as specified:
//   music:playback:{userId}:{trackId} -> { positionSec, version, updatedAt }
//   music:queue:{userId}:{deviceId}   -> { version, items[], currentIndex, shuffleEnabled, repeatMode }

export interface HotPosition {
  positionSec: number;
  version: number;
  updatedAt: string;
}

export interface QueueItem {
  trackId: string;
  source: string;
  addedAt: string;
}

export type RepeatMode = "OFF" | "ONE" | "ALL";

export interface QueueStateShape {
  version: number;
  items: QueueItem[];
  currentIndex: number;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
}

const MAX_QUEUE_SIZE = 500;

function positionKey(userId: string, trackId: string) {
  return `music:playback:${userId}:${trackId}`;
}
function queueKey(userId: string, deviceId: string) {
  return `music:queue:${userId}:${deviceId}`;
}
function sessionKey(sessionId: string) {
  return `music:session:${sessionId}`;
}

export const playbackRedis = {
  async getPosition(userId: string, trackId: string): Promise<HotPosition | null> {
    const raw = await redis.get(positionKey(userId, trackId));
    return raw ? (JSON.parse(raw) as HotPosition) : null;
  },

  /**
   * Section 9.1 rule #7: "A stale heartbeat must not overwrite a newer
   * position." We compare the incoming version to what's stored; a
   * heartbeat with an older/equal version is dropped silently.
   */
  async setPosition(userId: string, trackId: string, positionSec: number, version: number): Promise<void> {
    const key = positionKey(userId, trackId);
    const existingRaw = await redis.get(key);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw) as HotPosition;
      if (existing.version >= version) return; // stale write, ignore
    }
    const value: HotPosition = { positionSec, version, updatedAt: new Date().toISOString() };
    await redis.set(key, JSON.stringify(value), "EX", env.media.redisPlaybackTtlSec);
  },

  async getQueue(userId: string, deviceId: string): Promise<QueueStateShape | null> {
    const raw = await redis.get(queueKey(userId, deviceId));
    return raw ? (JSON.parse(raw) as QueueStateShape) : null;
  },

  async saveQueue(userId: string, deviceId: string, state: QueueStateShape): Promise<void> {
    if (state.items.length > MAX_QUEUE_SIZE) {
      throw AppError.unprocessable("QUEUE_TOO_LARGE", `Queue cannot exceed ${MAX_QUEUE_SIZE} items`);
    }
    await redis.set(queueKey(userId, deviceId), JSON.stringify(state));
  },

  emptyQueue(): QueueStateShape {
    return { version: 1, items: [], currentIndex: -1, shuffleEnabled: false, repeatMode: "OFF" };
  },

  async setSessionHotState(sessionId: string, state: unknown, ttlSec = 3600): Promise<void> {
    await redis.set(sessionKey(sessionId), JSON.stringify(state), "EX", ttlSec);
  },
  async getSessionHotState<T>(sessionId: string): Promise<T | null> {
    const raw = await redis.get(sessionKey(sessionId));
    return raw ? (JSON.parse(raw) as T) : null;
  },
};
