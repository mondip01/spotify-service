export const CACHE_TTL = {
  SEARCH_SECONDS: 60,
  USER_PROFILE_SECONDS: 300,
} as const;

export const CACHE_KEYS = {
  idempotency: (actorId: string, scope: string, key: string) => `music:idempotency:${actorId}:${scope}:${key}`,
} as const;
