import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    // Fail fast at boot rather than deep inside a request handler.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? Number(v) : fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? "development",
  serviceName: process.env.SERVICE_NAME ?? "music-service",
  port: num("PORT", 4000),

  mongoUri: required("MONGO_URI", "mongodb://localhost:27017/spotify_music"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  rabbitUrl: required("RABBITMQ_URL", "amqp://localhost:5672"),
  rabbitPrefetch: num("RABBITMQ_PREFETCH", 10),

  jwt: {
    secretOrPublicKey: required("JWT_PUBLIC_KEY_OR_SECRET", "dev-secret-change-me"),
    issuer: process.env.JWT_ISSUER ?? "spotify-auth-service",
  },

  authService: {
    baseUrl: process.env.AUTH_SERVICE_BASE_URL ?? "http://auth-service.internal",
    timeoutMs: num("AUTH_SERVICE_TIMEOUT_MS", 2000),
  },
  userService: {
    baseUrl: process.env.USER_SERVICE_BASE_URL ?? "http://user-service.internal",
    timeoutMs: num("USER_SERVICE_TIMEOUT_MS", 2000),
    profileCacheTtlSec: num("USER_PROFILE_CACHE_TTL_SEC", 300),
  },
  paymentService: {
    baseUrl: process.env.PAYMENT_SERVICE_BASE_URL ?? "http://payment-service.internal",
    timeoutMs: num("PAYMENT_SERVICE_TIMEOUT_MS", 2000),
  },
  notificationService: {
    queueName: process.env.NOTIFICATION_SERVICE_QUEUE ?? "music.notification.events",
  },

  r2: {
    endpoint: process.env.R2_ENDPOINT ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "spotify-music",
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? "",
  },

  media: {
    maxUploadSizeBytes: num("MAX_UPLOAD_SIZE_BYTES", 200 * 1024 * 1024),
    maxAudioDurationSec: num("MAX_AUDIO_DURATION_SEC", 1800),
    presignedUploadTtlSec: num("PRESIGNED_UPLOAD_TTL_SEC", 900),
  },

  playback: {
    urlTtlSec: num("PLAYBACK_URL_TTL_SEC", 300),
    heartbeatSec: num("PLAYBACK_HEARTBEAT_SEC", 10),
    redisPlaybackTtlSec: num("REDIS_PLAYBACK_TTL_SEC", 7 * 24 * 3600),
  },

  queue: {
    redisTtlSec: num("REDIS_QUEUE_TTL_SEC", 24 * 3600),
    maxItems: num("QUEUE_MAX_ITEMS", 500),
  },

  rateLimit: {
    defaultWindowSec: num("RATE_LIMIT_DEFAULT_WINDOW_SEC", 60),
    defaultMax: num("RATE_LIMIT_DEFAULT_MAX", 120),
    freePlaysPerDay: num("RATE_LIMIT_FREE_PLAYS_PER_DAY", 3),
  },

  circuitBreaker: {
    timeoutMs: num("CIRCUIT_BREAKER_TIMEOUT_MS", 2500),
    errorThresholdPercentage: num("CIRCUIT_BREAKER_ERROR_THRESHOLD_PERCENT", 50),
    resetTimeoutMs: num("CIRCUIT_BREAKER_RESET_TIMEOUT_MS", 10000),
  },
};
