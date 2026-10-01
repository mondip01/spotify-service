import { AnalyticsEvent } from "../models/analytics.schema";
import { Track } from "../models/catalog.schema";

export const analyticsRepository = {
  /** UNIQUE eventId makes this safe against RabbitMQ's at-least-once redelivery (section 14). */
  async recordEvent(doc: Partial<import("../models/analytics.schema").AnalyticsEventDoc>) {
    try {
      await AnalyticsEvent.create(doc);
      return true;
    } catch (err: any) {
      if (err?.code === 11000) return false; // duplicate delivery - already recorded, no-op
      throw err;
    }
  },

  /** Section 17: "Trending - Analytics-derived ranking + cached feed."
   * Simple recency-weighted proxy: most COMPLETED/PLAY_STARTED events in
   * the last 24h, grouped by track. */
  async computeTrendingTrackIds(limit: number, sinceHours = 24): Promise<string[]> {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);
    const rows = await AnalyticsEvent.aggregate([
      { $match: { occurredAt: { $gte: since }, eventType: { $in: ["PLAY_STARTED", "COMPLETED"] }, trackId: { $ne: null } } },
      { $group: { _id: "$trackId", plays: { $sum: 1 } } },
      { $sort: { plays: -1 } },
      { $limit: limit },
    ]);
    return rows.map((r) => String(r._id));
  },

  async applyTrendingFlags(trendingTrackIds: string[]) {
    await Track.updateMany({}, { $set: { isTrending: false } });
    if (trendingTrackIds.length > 0) {
      await Track.updateMany({ _id: { $in: trendingTrackIds } }, { $set: { isTrending: true } });
    }
  },
};
