import { Schema, model, Types } from "mongoose";

export type MediaJobType = "PROBE" | "TRANSCODE" | "PACKAGE_HLS" | "THUMBNAIL";
export type MediaJobStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "RETRYING";

export interface MediaJobDoc {
  mediaAssetId: Types.ObjectId;
  jobType: MediaJobType;
  status: MediaJobStatus;
  attempts: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  inputKey: string;
  outputKeys: string[];
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
}
const mediaJobSchema = new Schema<MediaJobDoc>(
  {
    mediaAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", required: true },
    jobType: { type: String, enum: ["PROBE", "TRANSCODE", "PACKAGE_HLS", "THUMBNAIL"], required: true },
    status: { type: String, enum: ["QUEUED", "PROCESSING", "SUCCEEDED", "FAILED", "RETRYING"], default: "QUEUED" },
    attempts: { type: Number, default: 0 },
    errorCode: { type: String, default: null },
    errorMessage: { type: String, default: null },
    inputKey: { type: String, required: true },
    outputKeys: { type: [String], default: [] },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
mediaJobSchema.index({ status: 1, createdAt: -1 });
mediaJobSchema.index({ mediaAssetId: 1, jobType: 1 });
export const MediaJob = model<MediaJobDoc>("MediaJob", mediaJobSchema);
