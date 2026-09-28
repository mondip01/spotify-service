import { Router } from "express";
import { queueController } from "./queue.controller";
import { requireAuth } from "../../shared/auth/authMiddleware";
import { validate } from "../../shared/validation/validate";
import { z } from "zod";

export const queueRouter = Router();

queueRouter.get("/queue", requireAuth, queueController.get);
queueRouter.post("/queue/tracks", requireAuth, validate({ body: z.object({ trackId: z.string(), source: z.string().optional() }) }), queueController.addTrack);
queueRouter.post(
  "/queue/tracks/bulk",
  requireAuth,
  validate({ body: z.object({ trackIds: z.array(z.string()).min(1).max(100), source: z.string().optional() }) }),
  queueController.addTracksBulk
);
queueRouter.delete("/queue/tracks/:trackId", requireAuth, queueController.removeTrack);
queueRouter.delete("/queue", requireAuth, queueController.clear);
queueRouter.patch("/queue/reorder", requireAuth, validate({ body: z.object({ orderedTrackIds: z.array(z.string()) }) }), queueController.reorder);
queueRouter.patch(
  "/queue/state",
  requireAuth,
  validate({
    body: z.object({
      shuffleEnabled: z.boolean().optional(),
      repeatMode: z.enum(["OFF", "ONE", "ALL"]).optional(),
      currentIndex: z.number().int().optional(),
    }),
  }),
  queueController.setState
);
