import { Request, Response } from "express";
import { asyncHandler } from "../errors/errorHandler";
import { ok } from "../utils/response";
import { playbackService } from "../services/playback.service";

export const playbackController = {
  startSession: asyncHandler(async (req: Request, res: Response) => {
    const { trackId, contextType, contextId, deviceId } = req.body;
    const result = await playbackService.startSession({
      userId: req.user!.userId,
      trackId,
      contextType: contextType ?? "OTHER",
      contextId,
      deviceId,
    });
    ok(req, res, result, 201);
  }),

  getSession: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playbackService.getSession(req.params.id, req.user!.userId));
  }),

  heartbeat: asyncHandler(async (req: Request, res: Response) => {
    const { positionSec } = req.body;
    ok(req, res, await playbackService.heartbeat(req.params.id, req.user!.userId, positionSec));
  }),

  pause: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playbackService.pause(req.params.id, req.user!.userId));
  }),

  resume: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playbackService.resume(req.params.id, req.user!.userId));
  }),

  seek: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playbackService.seek(req.params.id, req.user!.userId, req.body.positionSec));
  }),

  complete: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playbackService.complete(req.params.id, req.user!.userId));
  }),

  resolve: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playbackService.resolve(req.user!.userId, req.body.trackId));
  }),
};
