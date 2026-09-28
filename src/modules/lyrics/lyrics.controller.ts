import { Request, Response } from "express";
import { asyncHandler } from "../../shared/errors/errorHandler";
import { ok } from "../../shared/response";
import { lyricsService } from "./lyrics.service";

export const lyricsController = {
  getForTrack: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await lyricsService.getForTrack(req.params.id));
  }),
};
