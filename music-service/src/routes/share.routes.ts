import { Router } from "express";
import { shareController } from "../controllers/share.controller";
import { optionalAuth } from "../middlewares/authMiddleware";

export const shareRouter = Router();
shareRouter.post("/share/tracks/:id", optionalAuth, shareController.track);
shareRouter.post("/share/albums/:id", optionalAuth, shareController.album);
shareRouter.post("/share/playlists/:id", optionalAuth, shareController.playlist);
