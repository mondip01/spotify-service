import { Schema, model, Types } from "mongoose";

// ---- MediaAsset (section 5) ----
export type MediaOwnerType = "TRACK" | "ARTIST" | "ALBUM" | "CATEGORY";
export type MediaKind = "AUDIO" | "IMAGE" | "THUMBNAIL" | "SOURCE";
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
    ownerType: { type: String, enum: ["TRACK", "ARTIST", "ALBUM", "CATEGORY"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["AUDIO", "IMAGE", "THUMBNAIL", "SOURCE"], required: true },
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

