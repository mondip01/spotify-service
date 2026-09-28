import { Request, Response } from "express";
import { asyncHandler } from "../../shared/errors/errorHandler";
import { ok } from "../../shared/response";
import { playbackService } from "./playback.service";

// deviceId travels as a query param / header so the same set of routes
// works whether the client sends it either way; header takes precedence.
function deviceIdOf(req: Request): string {
  return (req.headers["x-device-id"] as string) || (req.query.deviceId as string) || "default";
}

export const queueController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playbackService.getQueue(req.user!.userId, deviceIdOf(req)));
  }),
  addTrack: asyncHandler(async (req: Request, res: Response) => {
    const { trackId, source } = req.body;
    ok(req, res, await playbackService.addTrack(req.user!.userId, deviceIdOf(req), trackId, source ?? "MANUAL"), 201);
  }),
  addTracksBulk: asyncHandler(async (req: Request, res: Response) => {
    const { trackIds, source } = req.body;
    ok(req, res, await playbackService.addTracksBulk(req.user!.userId, deviceIdOf(req), trackIds, source ?? "MANUAL"), 201);
  }),
  removeTrack: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playbackService.removeTrack(req.user!.userId, deviceIdOf(req), req.params.trackId));
  }),
  clear: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playbackService.clearQueue(req.user!.userId, deviceIdOf(req)));
  }),
  reorder: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playbackService.reorderQueue(req.user!.userId, deviceIdOf(req), req.body.orderedTrackIds));
  }),
  setState: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await playbackService.setQueueState(req.user!.userId, deviceIdOf(req), req.body));
  }),
};
