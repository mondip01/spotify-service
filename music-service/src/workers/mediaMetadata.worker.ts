import fs from "node:fs/promises";
import { consume, publish, QUEUES } from "../messaging/queueClient";
import { downloadToTempFile } from "../providers/storage/r2.provider";
import { ffprobe } from "../services/transcoding.service";
import { mediaRepository } from "../services/media.repository";
import { transcodingRepository } from "../services/transcoding.repository";
import { logger } from "../utils/logger";
import { env } from "../config/env";

interface MediaMetadataMessage {
  mediaAssetId: string;
  sourceKey: string;
}

// Section 10 worker step: "download/read source from R2 -> ffprobe
// actual codec/duration". This is the "PROBE" MediaJob. On success it
// chains straight into TRANSCODE - the two are almost always needed
// back-to-back, and chaining here keeps the API layer out of it entirely.
export async function startMediaMetadataWorker() {
  await consume<MediaMetadataMessage>(QUEUES.MEDIA_METADATA, async (envelope) => {
    const { mediaAssetId, sourceKey } = envelope.payload;
    const job = await transcodingRepository.create(mediaAssetId, "PROBE", sourceKey);
    await transcodingRepository.markProcessing(String(job._id));

    let localPath: string | null = null;
    try {
      localPath = await downloadToTempFile(sourceKey);
      const probe = await ffprobe(localPath);

      if (probe.durationSec > env.media.maxAudioDurationSec) {
        await mediaRepository.markStatus(mediaAssetId, "FAILED");
        await transcodingRepository.markFailed(String(job._id), "DURATION_EXCEEDED", "Audio exceeds MAX_AUDIO_DURATION_SEC");
        return;
      }

      await mediaRepository.markStatus(mediaAssetId, "PROCESSING", {
        durationSec: probe.durationSec,
        codec: probe.codec,
        bitrate: probe.bitrate,
      });
      await transcodingRepository.markSucceeded(String(job._id), []);

      await publish(QUEUES.MEDIA_TRANSCODE, { mediaAssetId, sourceKey });
      logger.info({ mediaAssetId }, "media_metadata_probed_chaining_to_transcode");
    } catch (err) {
      logger.error({ err, mediaAssetId }, "media_metadata_job_failed");
      await mediaRepository.markStatus(mediaAssetId, "FAILED");
      await transcodingRepository.markFailed(String(job._id), "PROBE_FAILED", String(err));
      throw err; // let queueClient's bounded retry/DLQ logic handle it
    } finally {
      if (localPath) await fs.unlink(localPath).catch(() => undefined);
    }
  });
}
