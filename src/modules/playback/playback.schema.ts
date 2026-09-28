import { Schema, model, Types } from "mongoose";

export type PlaybackContextType = "HOME" | "ALBUM" | "PLAYLIST" | "QUEUE" | "SEARCH" | "LIBRARY" | "OTHER";
export type PlaybackSessionState = "CREATED" | "PLAYING" | "PAUSED" | "STOPPED" | "COMPLETED" | "EXPIRED";

// ---- PlaybackProgress: durable resume position (section 5) ----
export interface PlaybackProgressDoc {
  userId: string;
  trackId: Types.ObjectId;
  positionSec: number;
  durationSec: number;
  completed: boolean;
  version: number;
  updatedAt: Date;
}
const playbackProgressSchema = new Schema<PlaybackProgressDoc>(
  {
    userId: { type: String, required: true },
    trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
    positionSec: { type: Number, required: true, default: 0 },
    durationSec: { type: Number, required: true },
    completed: { type: Boolean, required: true, default: false },
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);
// UNIQUE userId+trackId - "Redis mirrors this hot state; Mongo is durable fallback."
playbackProgressSchema.index({ userId: 1, trackId: 1 }, { unique: true });
export const PlaybackProgress = model<PlaybackProgressDoc>("PlaybackProgress", playbackProgressSchema);

// ---- PlaybackSession: one active playback attempt/device (section 5) ----
export interface PlaybackSessionDoc {
  sessionId: string;
  userId: string;
  trackId: Types.ObjectId;
  contextType: PlaybackContextType;
  contextId?: string | null;
  deviceId: string;
  positionSec: number;
  state: PlaybackSessionState;
  version: number;
  startedAt: Date;
  lastHeartbeatAt: Date;
  endedAt?: Date | null;
}
const playbackSessionSchema = new Schema<PlaybackSessionDoc>({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
  contextType: {
    type: String,
    enum: ["HOME", "ALBUM", "PLAYLIST", "QUEUE", "SEARCH", "LIBRARY", "OTHER"],
    default: "OTHER",
  },
  contextId: { type: String, default: null },
  deviceId: { type: String, required: true },
  positionSec: { type: Number, default: 0 },
  state: { type: String, enum: ["CREATED", "PLAYING", "PAUSED", "STOPPED", "COMPLETED", "EXPIRED"], default: "CREATED" },
  version: { type: Number, default: 1 },
  startedAt: { type: Date, default: () => new Date() },
  lastHeartbeatAt: { type: Date, default: () => new Date() },
  endedAt: { type: Date, default: null },
});
playbackSessionSchema.index({ userId: 1, state: 1, lastHeartbeatAt: 1 });
export const PlaybackSession = model<PlaybackSessionDoc>("PlaybackSession", playbackSessionSchema);
