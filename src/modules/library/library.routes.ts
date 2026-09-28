import { Router } from "express";
import { libraryController } from "./library.controller";
import { requireAuth } from "../../shared/auth/authMiddleware";

export const libraryRouter = Router();
libraryRouter.get("/library", requireAuth, libraryController.overview);
libraryRouter.get("/library/liked-songs", requireAuth, libraryController.likedSongs);
libraryRouter.post("/tracks/:id/like", requireAuth, libraryController.like);
libraryRouter.delete("/tracks/:id/like", requireAuth, libraryController.unlike);
libraryRouter.get("/history/recent", requireAuth, libraryController.recentlyPlayed);
libraryRouter.post("/history/events", requireAuth, libraryController.recordHistoryEvent);
