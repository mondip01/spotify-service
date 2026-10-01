import { Request, Response } from "express";
import { asyncHandler } from "../errors/errorHandler";
import { ok } from "../utils/response";
import { env } from "../config/env";
import { catalogService } from "../services/catalog.service";
import { AppError } from "../errors/AppError";
import { Album } from "../models/catalog.schema";
import { Playlist } from "../models/playlist.schema";

// Deep links resolve back to the same entity inside the app - no
// signed/expiring URL needed here, this is a public share link, not a
// playback authorization (that's a separate, entitlement-checked call).
function shareUrl(kind: string, id: string): string {
  const base = env.r2.publicBaseUrl || "https://app.spotify.example.com";
  return `${base}/share/${kind}/${id}`;
}

export const shareController = {
  track: asyncHandler(async (req: Request, res: Response) => {
    await catalogService.getTrack(req.params.id); // validates existence/playability
    ok(req, res, { url: shareUrl("track", req.params.id) }, 201);
  }),
  album: asyncHandler(async (req: Request, res: Response) => {
    const album = await Album.findOne({ _id: req.params.id, status: "PUBLISHED" }).lean();
    if (!album) throw AppError.notFound("ALBUM_NOT_FOUND", "Album not found");
    ok(req, res, { url: shareUrl("album", req.params.id) }, 201);
  }),
  playlist: asyncHandler(async (req: Request, res: Response) => {
    const playlist = await Playlist.findOne({ _id: req.params.id, visibility: "PUBLIC" }).lean();
    if (!playlist) throw AppError.notFound("PLAYLIST_NOT_FOUND_OR_PRIVATE", "Playlist not found or not shareable");
    ok(req, res, { url: shareUrl("playlist", req.params.id) }, 201);
  }),
};
