import { Router } from "express";
import { lyricsController } from "./lyrics.controller";
import { optionalAuth } from "../../shared/auth/authMiddleware";

export const lyricsRouter = Router();
lyricsRouter.get("/tracks/:id/lyrics", optionalAuth, lyricsController.getForTrack);
