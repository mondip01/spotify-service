import { Schema, model, Types } from "mongoose";

// ---- MediaAsset (section 5) ----
export type MediaOwnerType = "TRACK" | "ARTIST" | "ALBUM" | "CATEGORY" | "PODCAST" | "EPISODE";
export type MediaKind = "AUDIO" | "IMAGE" | "THUMBNAIL" | "LYRICS" | "SOURCE";
export type MediaAssetStatus = "UPLOADING" | "VALIDATING" | "PROCESSING" | "READY" | "FAILED";

export interface MediaAssetDoc {
  ownerType: MediaOwnerType;
  ownerId: Types.ObjectId;
  kind: MediaKind;
  visibility: "PUBLIC" | "PRIVATE";
  sourceKey?: string | null;
  playbackKey?: string | null;
  hlsMasterKey?: string | null;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number | null;
  codec?: string | null;
  bitrate?: number | null;
  status: MediaAssetStatus;
  processingJobId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
const mediaAssetSchema = new Schema<MediaAssetDoc>(
  {
    ownerType: { type: String, enum: ["TRACK", "ARTIST", "ALBUM", "CATEGORY", "PODCAST", "EPISODE"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["AUDIO", "IMAGE", "THUMBNAIL", "LYRICS", "SOURCE"], required: true },
    visibility: { type: String, enum: ["PUBLIC", "PRIVATE"], default: "PRIVATE" },
    sourceKey: { type: String, default: null },
    playbackKey: { type: String, default: null },
    hlsMasterKey: { type: String, default: null },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, default: 0 },
    durationSec: { type: Number, default: null },
    codec: { type: String, default: null },
    bitrate: { type: Number, default: null },
    status: { type: String, enum: ["UPLOADING", "VALIDATING", "PROCESSING", "READY", "FAILED"], default: "UPLOADING" },
    processingJobId: { type: Schema.Types.ObjectId, ref: "MediaJob", default: null },
  },
  { timestamps: true }
);
mediaAssetSchema.index({ status: 1, createdAt: -1 });
mediaAssetSchema.index({ sourceKey: 1 });
export const MediaAsset = model<MediaAssetDoc>("MediaAsset", mediaAssetSchema);

// ---- DownloadJob (section 5) ----
export interface DownloadJobDoc {
  userId: string;
  trackId: Types.ObjectId;
  mediaAssetId: Types.ObjectId;
  status: "REQUESTED" | "PROCESSING" | "READY" | "FAILED" | "EXPIRED" | "AUTHORIZED" | "REVOKED";
  entitlementSnapshot: Record<string, unknown>;
  objectKey?: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const downloadJobSchema = new Schema<DownloadJobDoc>(
  {
    userId: { type: String, required: true },
    trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
    mediaAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", required: true },
    status: {
      type: String,
      enum: ["REQUESTED", "PROCESSING", "READY", "FAILED", "EXPIRED", "AUTHORIZED", "REVOKED"],
      default: "REQUESTED",
    },
    // Minimal evidence of entitlement at request time (section 5) - so a
    // later entitlement revocation can be reasoned about/audited.
    entitlementSnapshot: { type: Schema.Types.Mixed, default: {} },
    objectKey: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
downloadJobSchema.index({ userId: 1, trackId: 1 });
export const DownloadJob = model<DownloadJobDoc>("DownloadJob", downloadJobSchema);
