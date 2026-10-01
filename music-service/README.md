# Music Service — Phase 1

A single Node.js/TypeScript music microservice covering the Phase 1 scope:
**catalog, media upload/transcoding, playback, queue, library, playlist,
search, analytics, admin, and sharing**.

Phase 2 features **lyrics, subscriptions, user downloads, and podcasts** have been removed from this version so they can be introduced later without mixing their business rules into the Phase 1 code.

## Project layout

```text
src/
  app.ts, server.ts
  config/             environment configuration
  constants/          shared constants
  controllers/        HTTP controllers
  cron/               scheduled-job entry point
  errors/             application errors and centralized error handling
  infra/              Mongo, Redis, HTTP client, circuit breaker
  lifecycle/          graceful shutdown
  messaging/          RabbitMQ producer/consumer helpers
  middlewares/        auth, RBAC, validation, rate limiting, idempotency
  models/             Mongoose models
  providers/storage/  Cloudflare R2 storage provider
  routes/             Express route registration
  scripts/            local utility scripts
  serializers/        response/value serializers
  services/           business logic and data-access services
  testing/            test-only configuration
  types/              Express/type declarations
  utils/              cache, logging, pagination, response helpers
  validators/         Zod and pagination validators
  workers/             media metadata, transcoding, analytics workers
  worker.ts           worker process entry point
```

## Phase 1 boundaries

- **Catalog:** artists, albums, categories and tracks.
- **Media:** direct-to-R2 uploads, upload completion, metadata extraction and
  HLS transcoding.
- **Playback:** signed playback URLs, resume position, sessions and queue.
- **Library:** likes, listening history and playlists.
- **Search:** tracks, albums and artists.
- **Analytics:** asynchronous playback events.
- **Admin:** catalog management, publishing, media reprocessing and jobs.
- **Share:** public share links for supported catalog resources.

## Deferred to Phase 2

- Lyrics
- Subscriptions / premium entitlement
- User downloads
- Podcasts / podcast episodes


## Running

```bash
cp .env.example .env
npm install
npm run dev
npm run worker:dev
```

The transcoding worker requires `ffmpeg` and `ffprobe` on PATH.

## API

All application routes are mounted below `/api/v1`. Health endpoints are
available at `/healthz` and `/readyz`.
