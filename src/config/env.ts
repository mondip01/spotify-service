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

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  serviceName: process.env.SERVICE_NAME ?? "music-service",

  mongoUri: required("MONGO_URI", "mongodb://localhost:27017/spotify_music"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  rabbitmqUrl: required("RABBITMQ_URL", "amqp://localhost:5672"),

  jwtSecretOrPublicKey: required("JWT_PUBLIC_KEY_OR_SECRET", "dev-secret"),
  jwtAlgorithm: (process.env.JWT_ALGORITHM ?? "HS256") as "HS256" | "RS256",

  r2: {
    endpoint: process.env.R2_ENDPOINT ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "spotify-music",
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? "",
  },

  externalServices: {
    authServiceBaseUrl: process.env.AUTH_SERVICE_BASE_URL ?? "http://auth-service:5001",
    userServiceBaseUrl: process.env.USER_SERVICE_BASE_URL ?? "http://user-service:5002",
    paymentServiceBaseUrl: process.env.PAYMENT_SERVICE_BASE_URL ?? "http://payment-service:5003",
    notificationServiceBaseUrl: process.env.NOTIFICATION_SERVICE_BASE_URL ?? "http://notification-service:5004",
  },

  media: {
    maxUploadSizeBytes: Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 200 * 1024 * 1024),
    maxAudioDurationSec: Number(process.env.MAX_AUDIO_DURATION_SEC ?? 1800),
    presignedUploadTtlSec: Number(process.env.PRESIGNED_UPLOAD_TTL_SEC ?? 900),
    playbackUrlTtlSec: Number(process.env.PLAYBACK_URL_TTL_SEC ?? 300),
    playbackHeartbeatSec: Number(process.env.PLAYBACK_HEARTBEAT_SEC ?? 10),
    redisPlaybackTtlSec: Number(process.env.REDIS_PLAYBACK_TTL_SEC ?? 604800),
  },

  rateLimit: {
    windowSec: Number(process.env.RATE_LIMIT_WINDOW_SEC ?? 60),
    maxDefault: Number(process.env.RATE_LIMIT_MAX_DEFAULT ?? 120),
    maxPlayback: Number(process.env.RATE_LIMIT_MAX_PLAYBACK ?? 30),
    maxUpload: Number(process.env.RATE_LIMIT_MAX_UPLOAD ?? 10),
  },

  circuitBreaker: {
    timeoutMs: Number(process.env.CIRCUIT_BREAKER_TIMEOUT_MS ?? 3000),
    errorThresholdPercentage: Number(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD ?? 50),
    resetTimeoutMs: Number(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS ?? 15000),
  },

  freeTierDailyPlayLimit: Number(process.env.FREE_TIER_DAILY_PLAY_LIMIT ?? 3),
};
