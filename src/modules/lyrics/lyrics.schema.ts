import { Schema, model, Types } from "mongoose";

export interface LyricLine {
  startMs: number;
  endMs: number;
  text: string;
}
export interface TrackLyricsDoc {
  trackId: Types.ObjectId;
  language: string;
  format: "PLAIN" | "TIMED";
  text?: string | null;
  lines?: LyricLine[] | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
const lineSchema = new Schema<LyricLine>(
  { startMs: Number, endMs: Number, text: String },
  { _id: false }
);
const trackLyricsSchema = new Schema<TrackLyricsDoc>(
  {
    trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
    language: { type: String, required: true, default: "hi" },
    format: { type: String, enum: ["PLAIN", "TIMED"], required: true },
    text: { type: String, default: null },
    lines: { type: [lineSchema], default: null },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);
// UNIQUE trackId+language+version (section 5).
trackLyricsSchema.index({ trackId: 1, language: 1, version: 1 }, { unique: true });
export const TrackLyrics = model<TrackLyricsDoc>("TrackLyrics", trackLyricsSchema);
