import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { publish, QUEUES } from "../messaging/queueClient";
import { transcodingRepository } from "./transcoding.repository";

const execFileAsync = promisify(execFile);

export interface ProbeResult {
  durationSec: number;
  codec: string;
  bitrate: number;
}

// Section 10 / 26: "FFprobe determines authoritative media metadata."
// The worker downloads the source to a local tmp path first (see
// workers/transcoding.worker.ts), then calls this against that local file.
export async function ffprobe(localFilePath: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=codec_name,bit_rate:format=duration",
    "-of", "json",
    localFilePath,
  ]);
  const parsed = JSON.parse(stdout);
  const stream = parsed.streams?.[0] ?? {};
  return {
    durationSec: Math.round(Number(parsed.format?.duration ?? 0)),
    codec: stream.codec_name ?? "unknown",
    bitrate: Number(stream.bit_rate ?? 0),
  };
}

// Section 26: "FFmpeg produces normalized playback outputs." Normalizes
// to a single-rendition HLS output (AAC 128kbps) - good enough for a
// devotional-audio catalog; can be extended to multi-bitrate renditions
// later without touching anything above the worker.
export async function ffmpegTranscodeToHls(localInputPath: string, outputDir: string): Promise<string[]> {
  const masterPath = `${outputDir}/index.m3u8`;
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", localInputPath,
    "-vn",
    "-c:a", "aac",
    "-b:a", "128k",
    "-hls_time", "6",
    "-hls_playlist_type", "vod",
    "-hls_segment_filename", `${outputDir}/segment-%05d.ts`,
    masterPath,
  ]);
  return [masterPath]; // caller globs outputDir for the segment files it also needs to upload
}

/** Admin "reprocess" action (section 7: POST /admin/media/:id/reprocess). */
export async function reprocessMediaAsset(mediaAssetId: string, sourceKey: string): Promise<void> {
  const job = await transcodingRepository.create(mediaAssetId, "TRANSCODE", sourceKey);
  await publish(QUEUES.MEDIA_TRANSCODE, { mediaAssetId, mediaJobId: String(job._id), sourceKey });
}
