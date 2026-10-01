import { MediaJob, MediaJobType } from "../models/transcoding.schema";

export const transcodingRepository = {
  create: (mediaAssetId: string, jobType: MediaJobType, inputKey: string) =>
    MediaJob.create({ mediaAssetId, jobType, inputKey, status: "QUEUED" }),

  findById: (id: string) => MediaJob.findById(id),
  findLatestForAsset: (mediaAssetId: string) => MediaJob.findOne({ mediaAssetId }).sort({ createdAt: -1 }),

  async markProcessing(id: string) {
    await MediaJob.updateOne({ _id: id }, { $set: { status: "PROCESSING", startedAt: new Date() }, $inc: { attempts: 1 } });
  },
  async markSucceeded(id: string, outputKeys: string[]) {
    await MediaJob.updateOne({ _id: id }, { $set: { status: "SUCCEEDED", outputKeys, completedAt: new Date() } });
  },
  async markFailed(id: string, errorCode: string, errorMessage: string) {
    await MediaJob.updateOne({ _id: id }, { $set: { status: "FAILED", errorCode, errorMessage, completedAt: new Date() } });
  },
};
