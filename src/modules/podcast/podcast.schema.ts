import { Schema, model, Types } from "mongoose";

export interface PodcastDoc {
  title: string;
  description?: string | null;
  publisherName?: string | null;
  coverAssetId?: Types.ObjectId | null;
  categoryIds: Types.ObjectId[];
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  createdAt: Date;
  updatedAt: Date;
}
const podcastSchema = new Schema<PodcastDoc>(
  {
    title: { type: String, required: true },
    description: { type: String, default: null },
    publisherName: { type: String, default: null },
    coverAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    status: { type: String, enum: ["DRAFT", "PUBLISHED", "UNPUBLISHED"], default: "DRAFT" },
  },
  { timestamps: true }
);
podcastSchema.index({ status: 1, updatedAt: -1 });
export const Podcast = model<PodcastDoc>("Podcast", podcastSchema);

export interface PodcastEpisodeDoc {
  podcastId: Types.ObjectId;
  title: string;
  description?: string | null;
  episodeNumber?: number | null;
  mediaAssetId: Types.ObjectId;
  durationSec: number;
  publishedAt?: Date | null;
  status: "DRAFT" | "PROCESSING" | "READY" | "PUBLISHED";
  createdAt: Date;
  updatedAt: Date;
}
const episodeSchema = new Schema<PodcastEpisodeDoc>(
  {
    podcastId: { type: Schema.Types.ObjectId, ref: "Podcast", required: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    episodeNumber: { type: Number, default: null },
    mediaAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", required: true },
    durationSec: { type: Number, required: true, default: 0 },
    publishedAt: { type: Date, default: null },
    status: { type: String, enum: ["DRAFT", "PROCESSING", "READY", "PUBLISHED"], default: "DRAFT" },
  },
  { timestamps: true }
);
episodeSchema.index({ podcastId: 1, publishedAt: -1 });
export const PodcastEpisode = model<PodcastEpisodeDoc>("PodcastEpisode", episodeSchema);

export interface PodcastFollowDoc {
  userId: string;
  podcastId: Types.ObjectId;
  createdAt: Date;
}
const followSchema = new Schema<PodcastFollowDoc>(
  {
    userId: { type: String, required: true },
    podcastId: { type: Schema.Types.ObjectId, ref: "Podcast", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
followSchema.index({ userId: 1, podcastId: 1 }, { unique: true });
export const PodcastFollow = model<PodcastFollowDoc>("PodcastFollow", followSchema);
