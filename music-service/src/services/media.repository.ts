import { MediaAsset } from "../models/media.schema";

export const mediaRepository = {
  create: (doc: Partial<import("../models/media.schema").MediaAssetDoc>) => MediaAsset.create(doc),

  findById: (id: string) => MediaAsset.findById(id),

  async markStatus(id: string, status: string, patch: Record<string, unknown> = {}) {
    await MediaAsset.updateOne({ _id: id }, { $set: { status, ...patch } });
  },
};
