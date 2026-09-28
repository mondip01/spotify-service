import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { consume, QUEUES } from "../shared/queue/queueClient";
import { downloadToTempFile, uploadDirectory, r2Keys } from "../shared/storage/r2Client";
import { ffmpegTranscodeToHls } from "../modules/transcoding/transcoding.service";
import { mediaRepository } from "../modules/media/media.repository";
import { transcodingRepository } from "../modules/transcoding/transcoding.repository";
import { Track } from "../modules/catalog/catalog.schema";
import { catalogService } from "../modules/catalog/catalog.service";
import { logger } from "../shared/logger";

interface TranscodeMessage {
  mediaAssetId: string;
  sourceKey: string;
}

// Section 10 worker step: "ffmpeg transcode/package -> upload final
// HLS/audio + metadata to R2 -> MediaAsset = READY". Also flips any
// Track pointing at this asset to READY so it becomes eligible for
// admin publish (section 19: "Admin reviews READY asset and publishes track").
export async function startTranscodingWorker() {
  await consume<TranscodeMessage>(QUEUES.MEDIA_TRANSCODE, QUEUES.MEDIA_TRANSCODE, async (envelope) => {
    const { mediaAssetId, sourceKey } = envelope.payload;
    const job = await transcodingRepository.create(mediaAssetId, "PACKAGE_HLS", sourceKey);
    await transcodingRepository.markProcessing(String(job._id));

    let localInputPath: string | null = null;
    let outputDir: string | null = null;
    try {
      localInputPath = await downloadToTempFile(sourceKey);
      outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "hls-"));

      await ffmpegTranscodeToHls(localInputPath, outputDir);

      const asset = await mediaRepository.findById(mediaAssetId);
      if (!asset) throw new Error(`MediaAsset ${mediaAssetId} disappeared mid-job`);

      const r2Prefix = `music/public/audio/${String(asset.ownerId)}`;
      const uploadedKeys = await uploadDirectory(outputDir, r2Prefix);
      const masterKey = uploadedKeys.find((k) => k.endsWith("index.m3u8")) ?? uploadedKeys[0];

      await mediaRepository.markStatus(mediaAssetId, "READY", {
        hlsMasterKey: masterKey,
        playbackKey: masterKey,
      });
      await transcodingRepository.markSucceeded(String(job._id), uploadedKeys);

      if (asset.ownerType === "TRACK") {
        await Track.updateOne({ _id: asset.ownerId }, { $set: { status: "READY" } });
        await catalogService.invalidateTrackCache(String(asset.ownerId));
      }

      logger.info({ mediaAssetId }, "transcoding_job_succeeded");
    } catch (err) {
      logger.error({ err, mediaAssetId }, "transcoding_job_failed");
      await mediaRepository.markStatus(mediaAssetId, "FAILED");
      await transcodingRepository.markFailed(String(job._id), "TRANSCODE_FAILED", String(err));
      throw err;
    } finally {
      if (localInputPath) await fs.unlink(localInputPath).catch(() => undefined);
      if (outputDir) await fs.rm(outputDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
}
