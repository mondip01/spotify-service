import { Router } from "express";
import { mediaController } from "./media.controller";
import { requireAuth } from "../../shared/auth/authMiddleware";
import { rateLimit } from "../../shared/rateLimit/rateLimit";
import { env } from "../../config/env";
import { validate } from "../../shared/validation/validate";
import { z } from "zod";

export const mediaRouter = Router();

mediaRouter.post(
  "/media/uploads",
  requireAuth,
  rateLimit("media-upload", env.rateLimit.maxUpload, env.rateLimit.windowSec),
  validate({
    body: z.object({
      ownerType: z.enum(["TRACK", "PODCAST", "EPISODE"]),
      ownerId: z.string(),
      mimeType: z.string(),
      sizeBytes: z.number().int().positive(),
    }),
  }),
  mediaController.createUpload
);
mediaRouter.get("/media/uploads/:id", requireAuth, mediaController.uploadStatus);
mediaRouter.post("/media/uploads/:id/complete", requireAuth, mediaController.completeUpload);

mediaRouter.post(
  "/tracks/:id/download",
  requireAuth,
  validate({ body: z.object({ mediaAssetId: z.string() }) }),
  mediaController.requestDownload
);
mediaRouter.get("/downloads", requireAuth, mediaController.listDownloads);
mediaRouter.get("/downloads/:id", requireAuth, mediaController.getDownload);
mediaRouter.delete("/downloads/:id", requireAuth, mediaController.removeDownload);
