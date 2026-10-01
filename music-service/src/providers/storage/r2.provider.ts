import AWS from "aws-sdk";
import { env } from "../../config/env";

// Cloudflare R2 is S3-compatible, so the AWS SDK's S3 client works
// against it by pointing endpoint at the R2 account endpoint and
// forcing path-style addressing. This is the ONLY place that talks to
// R2 directly - media.service.ts and the workers go through here.
export const r2 = new AWS.S3({
  endpoint: env.r2.endpoint,
  accessKeyId: env.r2.accessKeyId,
  secretAccessKey: env.r2.secretAccessKey,
  s3ForcePathStyle: true,
  signatureVersion: "v4",
  region: "auto",
});

export const R2_BUCKET = env.r2.bucket;

/**
 * Deterministic object key layout (section 10):
 *   music/temp/uploads/{uploadId}/source
 *   music/public/audio/{trackId}/master.m3u8
 *   music/public/audio/{trackId}/{rendition}/index.m3u8
 *   music/public/images/{assetId}/cover.webp
 */
export const r2Keys = {
  tempUploadSource: (uploadId: string, extension: string) => `music/temp/uploads/${uploadId}/source.${extension}`,
  publicAudioMaster: (trackId: string) => `music/public/audio/${trackId}/master.m3u8`,
  publicAudioRendition: (trackId: string, rendition: string, file: string) =>
    `music/public/audio/${trackId}/${rendition}/${file}`,
  publicImage: (assetId: string, file: string) => `music/public/images/${assetId}/${file}`,
};

export function getPresignedPutUrl(key: string, contentType: string, ttlSec: number): string {
  return r2.getSignedUrl("putObject", {
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    Expires: ttlSec,
  });
}

export function getPresignedGetUrl(key: string, ttlSec: number): string {
  return r2.getSignedUrl("getObject", {
    Bucket: R2_BUCKET,
    Key: key,
    Expires: ttlSec,
  });
}

export async function headObject(key: string) {
  return r2.headObject({ Bucket: R2_BUCKET, Key: key }).promise();
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await headObject(key);
    return true;
  } catch {
    return false;
  }
}

// ---- Used by the workers (workers/*.worker.ts) to move bytes between
// R2 and local disk for ffprobe/ffmpeg, which need real files, not streams. ----
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export async function downloadToTempFile(key: string): Promise<string> {
  const localPath = path.join(os.tmpdir(), `r2-${Date.now()}-${path.basename(key)}`);
  const body = await r2.getObject({ Bucket: R2_BUCKET, Key: key }).promise();
  await fs.promises.writeFile(localPath, body.Body as Buffer);
  return localPath;
}

export async function uploadFile(localPath: string, key: string, contentType: string): Promise<void> {
  const body = await fs.promises.readFile(localPath);
  await r2.putObject({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: contentType }).promise();
}

export async function uploadDirectory(localDir: string, r2Prefix: string): Promise<string[]> {
  const files = await fs.promises.readdir(localDir);
  const uploadedKeys: string[] = [];
  for (const file of files) {
    const key = `${r2Prefix}/${file}`;
    const contentType = file.endsWith(".m3u8")
      ? "application/vnd.apple.mpegurl"
      : file.endsWith(".ts")
      ? "video/mp2t"
      : "application/octet-stream";
    await uploadFile(path.join(localDir, file), key, contentType);
    uploadedKeys.push(key);
  }
  return uploadedKeys;
}
