import { Schema, model, Types } from "mongoose";

// ---- Artist (section 5) ----
export interface ArtistDoc {
  name: string;
  slug: string;
  bio?: string | null;
  imageAssetId?: Types.ObjectId | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}
const artistSchema = new Schema<ArtistDoc>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    bio: { type: String, default: null },
    imageAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);
artistSchema.index({ status: 1, name: 1 });
export const Artist = model<ArtistDoc>("Artist", artistSchema);

// ---- Category (section 5) ----
export interface CategoryDoc {
  name: string;
  slug: string;
  description?: string | null;
  imageAssetId?: Types.ObjectId | null;
  position: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}
const categorySchema = new Schema<CategoryDoc>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: null },
    imageAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    position: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);
categorySchema.index({ status: 1, position: 1 });
export const Category = model<CategoryDoc>("Category", categorySchema);

// ---- Album (section 5) ----
export interface AlbumDoc {
  title: string;
  artistIds: Types.ObjectId[];
  coverAssetId?: Types.ObjectId | null;
  description?: string | null;
  categoryIds: Types.ObjectId[];
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
const albumSchema = new Schema<AlbumDoc>(
  {
    title: { type: String, required: true },
    artistIds: [{ type: Schema.Types.ObjectId, ref: "Artist", required: true }],
    coverAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    description: { type: String, default: null },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    status: { type: String, enum: ["DRAFT", "PUBLISHED", "UNPUBLISHED"], default: "DRAFT" },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
albumSchema.index({ status: 1, publishedAt: -1 });
albumSchema.index({ artistIds: 1 });
export const Album = model<AlbumDoc>("Album", albumSchema);

// ---- Track (section 5) ----
export interface TrackDoc {
  title: string;
  artistIds: Types.ObjectId[];
  albumId?: Types.ObjectId | null;
  categoryIds: Types.ObjectId[];
  mediaAssetId: Types.ObjectId;
  durationSec: number;
  position?: number | null;
  status: "DRAFT" | "PROCESSING" | "READY" | "PUBLISHED" | "UNPUBLISHED";
  playCount: number;
  isFeatured: boolean;
  isTrending: boolean;
  isRecommended: boolean;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
const trackSchema = new Schema<TrackDoc>(
  {
    title: { type: String, required: true },
    artistIds: [{ type: Schema.Types.ObjectId, ref: "Artist", required: true }],
    albumId: { type: Schema.Types.ObjectId, ref: "Album", default: null },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    mediaAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", required: true },
    // Duration is server-derived from FFprobe (section 5) - never trust client input.
    durationSec: { type: Number, required: true, default: 0 },
    position: { type: Number, default: null },
    status: {
      type: String,
      enum: ["DRAFT", "PROCESSING", "READY", "PUBLISHED", "UNPUBLISHED"],
      default: "DRAFT",
    },
    playCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    isRecommended: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
trackSchema.index({ status: 1, publishedAt: -1 });
trackSchema.index({ albumId: 1, position: 1 });
trackSchema.index({ categoryIds: 1, publishedAt: -1 });
trackSchema.index({ isFeatured: 1 });
trackSchema.index({ isTrending: 1 });
export const Track = model<TrackDoc>("Track", trackSchema);
