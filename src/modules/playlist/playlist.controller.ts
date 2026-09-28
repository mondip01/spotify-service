import { Request, Response } from "express";
import { asyncHandler } from "../../shared/errors/errorHandler";
import { ok } from "../../shared/response";
import { playlistRepository } from "./playlist.repository";
import { withIdempotency } from "../../shared/idempotency/idempotency";

export const playlistController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = req.body;
    const playlist = await playlistRepository.create(req.user!.userId, name, description);
    ok(req, res, playlist, 201);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playlistRepository.findByUser(req.user!.userId));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playlistRepository.findOwned(req.params.id, req.user!.userId));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    await playlistRepository.update(req.params.id, req.user!.userId, req.body);
    ok(req, res, await playlistRepository.findOwned(req.params.id, req.user!.userId));
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await playlistRepository.remove(req.params.id, req.user!.userId);
    ok(req, res, { deleted: true });
  }),

  tracks: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playlistRepository.orderedTracks(req.params.id));
  }),

  addTracks: asyncHandler(async (req: Request, res: Response) => {
    // Section 8: Idempotency-Key recommended on playlist mutation - see Appendix B.
    const playlist = await withIdempotency("playlist-add-tracks", req.user!.userId, req, () =>
      playlistRepository.addTracks(req.params.id, req.user!.userId, req.body.trackIds)
    );
    ok(req, res, playlist);
  }),

  removeTrack: asyncHandler(async (req: Request, res: Response) => {
    await playlistRepository.removeTrack(req.params.id, req.user!.userId, req.params.trackId);
    ok(req, res, { removed: true });
  }),

  reorder: asyncHandler(async (req: Request, res: Response) => {
    const { version, orderedTrackIds } = req.body;
    await playlistRepository.reorder(req.params.id, req.user!.userId, version, orderedTrackIds);
    ok(req, res, await playlistRepository.findOwned(req.params.id, req.user!.userId));
  }),
};
