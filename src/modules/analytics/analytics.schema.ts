import { Schema, model, Types } from "mongoose";

export interface AnalyticsEventDoc {
  eventId: string;
  userId?: string | null;
  sessionId?: string | null;
  eventType: string; // PLAY_STARTED, PAUSED, SEEK, COMPLETED, etc.
  trackId?: Types.ObjectId | null;
  positionSec?: number | null;
  contextType?: string | null;
  contextId?: string | null;
  deviceId?: string | null;
  occurredAt: Date;
  receivedAt: Date;
}
const analyticsEventSchema = new Schema<AnalyticsEventDoc>({
  eventId: { type: String, required: true, unique: true }, // idempotency (section 14)
  userId: { type: String, default: null },
  sessionId: { type: String, default: null },
  eventType: { type: String, required: true },
  trackId: { type: Schema.Types.ObjectId, ref: "Track", default: null },
  positionSec: { type: Number, default: null },
  contextType: { type: String, default: null },
  contextId: { type: String, default: null },
  deviceId: { type: String, default: null },
  occurredAt: { type: Date, required: true },
  receivedAt: { type: Date, required: true, default: () => new Date() },
});
analyticsEventSchema.index({ userId: 1, occurredAt: -1 });
analyticsEventSchema.index({ trackId: 1, occurredAt: -1 });
export const AnalyticsEvent = model<AnalyticsEventDoc>("AnalyticsEvent", analyticsEventSchema);
