import { Request, Response } from "express";
import { asyncHandler } from "../errors/errorHandler";
import { ok } from "../utils/response";
import { mediaService } from "../services/media.service";

export const mediaController = {
  createUpload: asyncHandler(async (req: Request, res: Response) => {
    const { ownerType, ownerId, mimeType, sizeBytes } = req.body;
    const session = await mediaService.createUploadSession(ownerType, ownerId, mimeType, sizeBytes);
    ok(req, res, session, 201);
  }),

  uploadStatus: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await mediaService.getUploadStatus(req.params.id));
  }),

  completeUpload: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await mediaService.completeUpload(req.params.id, req.user!.userId, req));
  }),
};
