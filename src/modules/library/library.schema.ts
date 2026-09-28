import { Schema, model, Types } from "mongoose";

// ---- TrackLike (section 5) ----
export interface TrackLikeDoc {
  userId: string;
  trackId: Types.ObjectId;
  createdAt: Date;
}
const trackLikeSchema = new Schema<TrackLikeDoc>(
  {
    userId: { type: String, required: true },
    trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
// UNIQUE userId+trackId - "turns like into a set and makes retries safe."
trackLikeSchema.index({ userId: 1, trackId: 1 }, { unique: true });
export const TrackLike = model<TrackLikeDoc>("TrackLike", trackLikeSchema);

// ---- ListeningHistory (section 5) ----
export type PlaybackContextType = "HOME" | "ALBUM" | "PLAYLIST" | "SEARCH" | "QUEUE" | "PODCAST" | "OTHER";

export interface ListeningHistoryDoc {
  userId: string;
  trackId: Types.ObjectId;
  sessionId: string;
  contextType: PlaybackContextType;
  contextId?: string | null;
  startedAt: Date;
  playedSec: number;
  completed: boolean;
  createdAt: Date;
}
const listeningHistorySchema = new Schema<ListeningHistoryDoc>(
  {
    userId: { type: String, required: true },
    trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
    sessionId: { type: String, required: true },
    contextType: {
      type: String,
      enum: ["HOME", "ALBUM", "PLAYLIST", "SEARCH", "QUEUE", "PODCAST", "OTHER"],
      required: true,
    },
    contextId: { type: String, default: null },
    startedAt: { type: Date, required: true },
    playedSec: { type: Number, required: true, default: 0 },
    completed: { type: Boolean, required: true, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
listeningHistorySchema.index({ userId: 1, createdAt: -1 });
export const ListeningHistory = model<ListeningHistoryDoc>("ListeningHistory", listeningHistorySchema);
