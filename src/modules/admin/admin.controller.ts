import { Request, Response } from "express";
import { asyncHandler } from "../../shared/errors/errorHandler";
import { ok } from "../../shared/response";
import { AppError } from "../../shared/errors/AppError";
import { Artist, Album, Track } from "../catalog/catalog.schema";
import { catalogService } from "../catalog/catalog.service";
import { transcodingRepository } from "../transcoding/transcoding.repository";
import { reprocessMediaAsset } from "../transcoding/transcoding.service";
import { mediaRepository } from "../media/media.repository";
import { lyricsService } from "../lyrics/lyrics.service";

// Section 19 Admin Workflow, section 7 Admin API blueprint. Every route
// here is behind requireAuth + requireAdmin (see admin.routes.ts).
export const adminController = {
  createArtist: asyncHandler(async (req: Request, res: Response) => {
    const artist = await Artist.create(req.body);
    ok(req, res, artist, 201);
  }),
  updateArtist: asyncHandler(async (req: Request, res: Response) => {
    const artist = await Artist.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!artist) throw AppError.notFound("ARTIST_NOT_FOUND", "Artist not found");
    ok(req, res, artist);
  }),

  createAlbum: asyncHandler(async (req: Request, res: Response) => {
    const album = await Album.create(req.body);
    ok(req, res, album, 201);
  }),
  updateAlbum: asyncHandler(async (req: Request, res: Response) => {
    const album = await Album.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!album) throw AppError.notFound("ALBUM_NOT_FOUND", "Album not found");
    ok(req, res, album);
  }),

  createTrack: asyncHandler(async (req: Request, res: Response) => {
    // Client-supplied durationSec is deliberately ignored here (section
    // 4/5) - it gets overwritten once FFprobe results land via the
    // media metadata worker.
    const track = await Track.create({ ...req.body, durationSec: 0, status: "DRAFT" });
    ok(req, res, track, 201);
  }),
  updateTrack: asyncHandler(async (req: Request, res: Response) => {
    const { durationSec, ...patch } = req.body; // never let a client PATCH override server-derived duration
    const track = await Track.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!track) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");
    await catalogService.invalidateTrackCache(req.params.id);
    ok(req, res, track);
  }),

  publishTrack: asyncHandler(async (req: Request, res: Response) => {
    const track = await Track.findById(req.params.id);
    if (!track) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");
    if (track.status !== "READY") {
      throw AppError.unprocessable("TRACK_NOT_READY", "Track's media must be READY before publishing");
    }
    track.status = "PUBLISHED";
    track.publishedAt = new Date();
    await track.save();
    await catalogService.invalidateTrackCache(req.params.id);
    ok(req, res, track);
  }),

  unpublishTrack: asyncHandler(async (req: Request, res: Response) => {
    const track = await Track.findByIdAndUpdate(req.params.id, { status: "UNPUBLISHED" }, { new: true });
    if (!track) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");
    await catalogService.invalidateTrackCache(req.params.id);
    ok(req, res, track);
  }),

  setTrackFlags: asyncHandler(async (req: Request, res: Response) => {
    const { isFeatured, isTrending, isRecommended } = req.body;
    const track = await Track.findByIdAndUpdate(
      req.params.id,
      { $set: { isFeatured, isTrending, isRecommended } },
      { new: true }
    );
    if (!track) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");
    await catalogService.invalidateTrackCache(req.params.id);
    ok(req, res, track);
  }),

  upsertLyrics: asyncHandler(async (req: Request, res: Response) => {
    const { language, format, text, lines } = req.body;
    const doc = await lyricsService.upsert(req.params.id, language ?? "hi", format, text, lines);
    ok(req, res, doc, 201);
  }),

  reprocessMedia: asyncHandler(async (req: Request, res: Response) => {
    const asset = await mediaRepository.findById(req.params.id);
    if (!asset || !asset.sourceKey) throw AppError.notFound("MEDIA_ASSET_NOT_FOUND", "Media asset or its source is missing");
    await reprocessMediaAsset(String(asset._id), asset.sourceKey);
    ok(req, res, { mediaAssetId: String(asset._id), status: "QUEUED" }, 202);
  }),

  getJob: asyncHandler(async (req: Request, res: Response) => {
    const job = await transcodingRepository.findById(req.params.id);
    if (!job) throw AppError.notFound("JOB_NOT_FOUND", "Media job not found");
    ok(req, res, job);
  }),
};
