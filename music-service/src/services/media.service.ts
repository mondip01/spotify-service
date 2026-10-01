import { v4 as uuid } from "uuid";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import { mediaRepository } from "./media.repository";
import { getPresignedPutUrl, getPresignedGetUrl, objectExists, r2Keys } from "../providers/storage/r2.provider";
import { publish, QUEUES } from "../messaging/queueClient";
import { withIdempotency } from "../middlewares/idempotency";
import { withLock } from "./lockService";
import { Request } from "express";

const ALLOWED_AUDIO_MIME = new Set(["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/x-wav"]);

export const mediaService = {
  /**
   * Section 10, step 1: validate type/size/ownership, create MediaAsset =
   * UPLOADING, generate a presigned R2 PUT the client uploads directly
   * to (Node.js never touches the audio bytes).
   */
  async createUploadSession(ownerType: "TRACK", ownerId: string, mimeType: string, sizeBytes: number) {
    if (!ALLOWED_AUDIO_MIME.has(mimeType)) {
      throw AppError.badRequest("UNSUPPORTED_MEDIA_TYPE", `Unsupported audio mime type: ${mimeType}`);
    }
    if (sizeBytes > env.media.maxUploadSizeBytes) {
      throw AppError.badRequest("FILE_TOO_LARGE", "Upload exceeds MAX_UPLOAD_SIZE_BYTES");
    }

    const uploadId = uuid();
    const extension = mimeType.split("/")[1]?.replace("x-", "") ?? "bin";
    const sourceKey = r2Keys.tempUploadSource(uploadId, extension);

    const asset = await mediaRepository.create({
      ownerType,
      ownerId: ownerId as any,
      kind: "AUDIO",
      visibility: "PRIVATE",
      sourceKey,
      mimeType,
      sizeBytes,
      status: "UPLOADING",
    });

    const putUrl = getPresignedPutUrl(sourceKey, mimeType, env.media.presignedUploadTtlSec);
    return { uploadId, mediaAssetId: String(asset._id), putUrl, expiresInSec: env.media.presignedUploadTtlSec };
  },

  async getUploadStatus(mediaAssetId: string) {
    const asset = await mediaRepository.findById(mediaAssetId);
    if (!asset) throw AppError.notFound("MEDIA_ASSET_NOT_FOUND", "Media asset not found");
    return asset;
  },

  /**
   * Section 10, step 2: verify the object actually landed in R2 (never
   * trust the client's "I'm done" alone), transition to VALIDATING, and
   * enqueue the metadata/transcode job. Idempotency-Key protects against
   * a retried "complete" call double-enqueuing the job.
   */
  async completeUpload(mediaAssetId: string, userId: string, req: Request) {
    return withLock(`music:lock:media-upload:${mediaAssetId}`, { ttlSeconds: 30, waitMs: 1000 }, () =>
      withIdempotency("media-upload-complete", userId, req, async () => {
      const asset = await mediaRepository.findById(mediaAssetId);
      if (!asset) throw AppError.notFound("MEDIA_ASSET_NOT_FOUND", "Media asset not found");
      if (asset.status !== "UPLOADING") {
        return { mediaAssetId, status: asset.status }; // already progressed - idempotent no-op
      }
      if (!asset.sourceKey || !(await objectExists(asset.sourceKey))) {
        await mediaRepository.markStatus(mediaAssetId, "FAILED");
        throw AppError.unprocessable("UPLOAD_OBJECT_MISSING", "Uploaded object was not found in storage");
      }

      await mediaRepository.markStatus(mediaAssetId, "VALIDATING");
      await publish(QUEUES.MEDIA_METADATA, { mediaAssetId, sourceKey: asset.sourceKey });

        return { mediaAssetId, status: "VALIDATING" };
      }),
    );
  },

  /**
   * Section 9: "The API authorizes playback and returns controlled
   * access; R2/CDN serves the media." Never returns a permanent URL -
   * always a short-lived signed one, and never proxies bytes.
   */
  async getPlaybackUrl(mediaAssetId: string): Promise<{ url: string; expiresAt: string }> {
    const asset = await mediaRepository.findById(mediaAssetId);
    if (!asset || asset.status !== "READY") {
      throw AppError.unprocessable("MEDIA_NOT_READY", "Media is not ready for playback");
    }
    const key = asset.hlsMasterKey ?? asset.playbackKey;
    if (!key) throw AppError.internal("Playable object key missing on a READY asset");

    const url = getPresignedGetUrl(key, env.media.playbackUrlTtlSec);
    const expiresAt = new Date(Date.now() + env.media.playbackUrlTtlSec * 1000).toISOString();
    return { url, expiresAt };
  },
};
