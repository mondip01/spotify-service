import { MediaAsset, DownloadJob } from "./media.schema";

export const mediaRepository = {
  create: (doc: Partial<import("./media.schema").MediaAssetDoc>) => MediaAsset.create(doc),
  findById: (id: string) => MediaAsset.findById(id),
  async markStatus(id: string, status: string, patch: Record<string, unknown> = {}) {
    await MediaAsset.updateOne({ _id: id }, { $set: { status, ...patch } });
  },

  createDownloadJob: (doc: Partial<import("./media.schema").DownloadJobDoc>) => DownloadJob.create(doc),
  findDownloadsByUser: (userId: string) => DownloadJob.find({ userId }).sort({ createdAt: -1 }).lean(),
  findDownloadById: (id: string, userId: string) => DownloadJob.findOne({ _id: id, userId }).lean(),
  removeDownload: (id: string, userId: string) => DownloadJob.deleteOne({ _id: id, userId }),
  revokeExpiredOrCancelledDownloads: (userId: string) =>
    DownloadJob.updateMany({ userId, status: "AUTHORIZED" }, { $set: { status: "REVOKED" } }),
};
