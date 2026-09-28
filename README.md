# spotify  Service

One microservice covering **catalog, streaming/media, playback, queue,
library, playlist, podcast, lyrics, search, a temporary local
subscription module, analytics, admin, and share** — built from the
` spotify Service — Final System Design v2` document.

Auth, User, Payment, and Notification are **existing, separate**
microservices. This service never issues tokens, never stores full user
profiles, and never becomes the permanent billing authority — it only
integrates with those services (see `src/integrations/`). **There is no
API Gateway** — every route below is served directly by this service.

## Project layout

```
src/
  server.ts, app.ts        - HTTP entrypoint, Express app wiring
  config/env.ts             - all environment variables in one typed object
  shared/                   - cross-cutting infra used by every module
    errors/                 - AppError + centralized error handler
    validation/              - Zod request validation + cursor pagination
    auth/                    - JWT verification (local) + RBAC
    idempotency/              - Idempotency-Key handling (Redis)
    rateLimit/                - Redis token-bucket rate limiting + free-tier cap
    cache/                    - Redis client + cache-aside helper
    circuitBreaker/            - Opossum-based breaker factory
    queue/                    - the reusable RabbitMQ producer/consumer package
    storage/                  - Cloudflare R2 client (S3-compatible)
    db/                       - Mongo connection
  integrations/              - Auth/User/Payment/Notification service clients
  modules/                    - one folder per domain (see design doc section 23)
    catalog, home, podcast, library, playlist, playback, media,
    transcoding, lyrics, search, subscription, analytics, admin, share
  workers/                     - separate process: mediaMetadata, transcoding,
                                 analytics consumers (run via `npm run start:worker`)
  routes/index.ts               - mounts every module's router under /api/v1
postman/
  spotify-Music-Service.postman_collection.json
```

Each module generally has: `*.schema.ts` (Mongoose models), `*.repository.ts`
(data access), `*.service.ts` (business rules), `*.controller.ts` (HTTP
handlers), `*.routes.ts` (Express router) — exactly the structure in
section 23 of the design doc.

## Running it

```bash
cp .env.example .env        # fill in Mongo/Redis/RabbitMQ/R2/service URLs
npm install
npm run dev                  # API on PORT (default 4000)
npm run worker:dev           # separate process: transcoding + analytics workers
```

Requires `ffmpeg` and `ffprobe` on PATH for the transcoding worker
(`apt install ffmpeg` covers both).

## How the pieces fit together

- **No API Gateway**: `app.ts` mounts everything directly. JWT auth is
  verified locally in `shared/auth/authMiddleware.ts` using the same
  secret/public key the Auth Service signs with — no network hop needed
  on the common path.
- **User Service**: `integrations/userService.client.ts` fetches just a
  display name/avatar/role, cached briefly in Redis. This service never
  stores a user's profile.
- **Payment Service**: `integrations/paymentService.client.ts` is the
  charge integration point. Today it's called by the *temporary*
  `subscription` module; when Payment Service becomes the real billing
  authority, only `subscription.repository.ts`/`subscription.service.ts`
  change — nothing in `playback` or `media` has to.
- **Notification Service**: `integrations/notificationService.client.ts`
  publishes onto `music.notification.events` (preferred, async) with a
  direct-HTTP fallback. A Notification Service outage never fails the
  calling music operation.
- **Playback resume**: `modules/playback/playback.redis.ts` holds the hot
  position (`music:playback:{userId}:{trackId}`); `playback.repository.ts`
  is the durable Mongo fallback. Version numbers on both sides mean a
  stale heartbeat can never move the position backwards.
- **Queue**: `music:queue:{userId}:{deviceId}` in Redis — add/remove/
  reorder/bulk-add/shuffle/repeat, exactly as specified in section 11.
- **Media pipeline**: `POST /media/uploads` issues a presigned R2 PUT the
  client uploads to directly (Node never touches audio bytes) →
  `POST /media/uploads/:id/complete` enqueues `music.media.metadata` →
  `workers/mediaMetadata.worker.ts` runs `ffprobe`, chains into
  `music.media.transcode` → `workers/transcoding.worker.ts` runs `ffmpeg`,
  packages HLS, uploads to R2, flips the asset (and its Track) to READY.
- **Circuit breakers**: every `integrations/*.client.ts` call is wrapped
  via `shared/circuitBreaker/breaker.ts` (Opossum) with a safe fallback —
  never a fake success, per section 15.

## Postman collection

Import `postman/spotify-Music-Service.postman_collection.json`. Set the
collection variables:

- `baseUrl` — e.g. `http://localhost:4000`
- `accessToken` — a JWT issued by the Auth Service (this service only
  verifies it, so mint one with the same secret from `.env`'s
  `JWT_PUBLIC_KEY_OR_SECRET` for local testing, `sub`/`role` claims set)
- `trackId`, `albumId`, `artistId`, `playlistId`, `podcastId`,
  `categoryId`, `sessionId`, `mediaAssetId`, `downloadId`, `jobId`,
  `deviceId` — fill in as you exercise the flows (create an admin track
  first, publish it, then everything downstream has a real trackId)

Folders mirror the design doc's domains: Home, Catalog, Search, Podcast,
Library, Playlist, Queue, Playback, Lyrics, Share, Media & Downloads,
Subscription (temporary), Analytics, Admin.
