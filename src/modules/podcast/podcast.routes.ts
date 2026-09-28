import { Router } from "express";
import { podcastController } from "./podcast.controller";
import { optionalAuth, requireAuth } from "../../shared/auth/authMiddleware";

export const podcastRouter = Router();
podcastRouter.get("/podcasts", optionalAuth, podcastController.list);
podcastRouter.get("/podcasts/:id", optionalAuth, podcastController.getById);
podcastRouter.get("/podcasts/:id/episodes", optionalAuth, podcastController.episodes);
podcastRouter.post("/podcasts/:id/follow", requireAuth, podcastController.follow);
podcastRouter.delete("/podcasts/:id/follow", requireAuth, podcastController.unfollow);
