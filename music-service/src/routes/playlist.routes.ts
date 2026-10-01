import { Router } from "express";
import { playlistController } from "../controllers/playlist.controller";
import { requireAuth } from "../middlewares/authMiddleware";
import { validate } from "../validators/validate";
import { z } from "zod";

export const playlistRouter = Router();

playlistRouter.post(
  "/playlists",
  requireAuth,
  validate({ body: z.object({ name: z.string().min(1).max(120), description: z.string().max(500).optional() }) }),
  playlistController.create
);
playlistRouter.get("/playlists", requireAuth, playlistController.list);
playlistRouter.get("/playlists/:id", requireAuth, playlistController.getById);
playlistRouter.patch(
  "/playlists/:id",
  requireAuth,
  validate({ body: z.object({ name: z.string().min(1).max(120).optional(), description: z.string().max(500).optional() }) }),
  playlistController.update
);
playlistRouter.delete("/playlists/:id", requireAuth, playlistController.remove);

playlistRouter.get("/playlists/:id/tracks", requireAuth, playlistController.tracks);
playlistRouter.post(
  "/playlists/:id/tracks",
  requireAuth,
  validate({ body: z.object({ trackIds: z.array(z.string()).min(1).max(50) }) }),
  playlistController.addTracks
);
playlistRouter.delete("/playlists/:id/tracks/:trackId", requireAuth, playlistController.removeTrack);
playlistRouter.patch(
  "/playlists/:id/reorder",
  requireAuth,
  validate({ body: z.object({ version: z.number().int(), orderedTrackIds: z.array(z.string()) }) }),
  playlistController.reorder
);
