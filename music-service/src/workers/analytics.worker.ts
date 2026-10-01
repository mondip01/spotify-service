import { consume, QUEUES } from "../messaging/queueClient";
import { analyticsRepository } from "../services/analytics.repository";
import { logger } from "../utils/logger";

interface AnalyticsMessage {
  eventId: string;
  userId?: string | null;
  sessionId?: string | null;
  eventType: string;
  trackId?: string | null;
  positionSec?: number | null;
  contextType?: string | null;
  contextId?: string | null;
  occurredAt: string;
}

let eventsSinceLastTrendingRecompute = 0;
const TRENDING_RECOMPUTE_EVERY_N_EVENTS = 200;

export async function startAnalyticsWorker() {
  await consume<AnalyticsMessage>(QUEUES.ANALYTICS_EVENTS, async (envelope) => {
    const e = envelope.payload;

    const inserted = await analyticsRepository.recordEvent({
      eventId: e.eventId,
      userId: e.userId ?? null,
      sessionId: e.sessionId ?? null,
      eventType: e.eventType,
      trackId: (e.trackId as any) ?? null,
      positionSec: e.positionSec ?? null,
      contextType: e.contextType ?? null,
      contextId: e.contextId ?? null,
      occurredAt: new Date(e.occurredAt),
      receivedAt: new Date(),
    });

    if (!inserted) {
      logger.debug({ eventId: e.eventId }, "analytics_event_duplicate_ignored");
      return; // idempotent no-op on redelivery
    }

    eventsSinceLastTrendingRecompute += 1;
    if (eventsSinceLastTrendingRecompute >= TRENDING_RECOMPUTE_EVERY_N_EVENTS) {
      eventsSinceLastTrendingRecompute = 0;
      const trendingIds = await analyticsRepository.computeTrendingTrackIds(20);
      await analyticsRepository.applyTrendingFlags(trendingIds);
      logger.info({ count: trendingIds.length }, "trending_flags_recomputed");
    }
  });
}
