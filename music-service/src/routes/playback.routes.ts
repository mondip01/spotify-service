import { Router } from "express";
import { playbackController } from "../controllers/playback.controller";
import { requireAuth } from "../middlewares/authMiddleware";
import { rateLimit } from "../middlewares/rateLimit";
import { env } from "../config/env";
import { validate } from "../validators/validate";
import { z } from "zod";

export const playbackRouter = Router();

playbackRouter.post(
  "/playback/sessions",
  requireAuth,
  rateLimit("playback-session", env.rateLimit.maxPlayback, env.rateLimit.windowSec),
  validate({
    body: z.object({
      trackId: z.string(),
      contextType: z.enum(["HOME", "ALBUM", "PLAYLIST", "QUEUE", "SEARCH", "LIBRARY", "OTHER"]).optional(),
      contextId: z.string().optional(),
      deviceId: z.string(),
    }),
  }),
  playbackController.startSession
);
playbackRouter.get("/playback/sessions/:id", requireAuth, playbackController.getSession);
playbackRouter.patch(
  "/playback/sessions/:id/progress",
  requireAuth,
  validate({ body: z.object({ positionSec: z.number().min(0) }) }),
  playbackController.heartbeat
);
playbackRouter.post("/playback/sessions/:id/pause", requireAuth, playbackController.pause);
playbackRouter.post("/playback/sessions/:id/resume", requireAuth, playbackController.resume);
playbackRouter.post(
  "/playback/sessions/:id/seek",
  requireAuth,
  validate({ body: z.object({ positionSec: z.number().min(0) }) }),
  playbackController.seek
);
playbackRouter.post("/playback/sessions/:id/complete", requireAuth, playbackController.complete);
playbackRouter.post(
  "/playback/resolve",
  requireAuth,
  validate({ body: z.object({ trackId: z.string() }) }),
  playbackController.resolve
);
