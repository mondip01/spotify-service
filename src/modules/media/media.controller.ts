import { Request, Response } from "express";
import { asyncHandler } from "../../shared/errors/errorHandler";
import { ok } from "../../shared/response";
import { mediaService } from "./media.service";

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

  requestDownload: asyncHandler(async (req: Request, res: Response) => {
    const { mediaAssetId } = req.body;
    ok(req, res, await mediaService.requestDownload(req.user!.userId, req.params.id, mediaAssetId), 201);
  }),

  listDownloads: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await mediaService.listDownloads(req.user!.userId));
  }),

  getDownload: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await mediaService.getDownload(req.params.id, req.user!.userId));
  }),

  removeDownload: asyncHandler(async (req: Request, res: Response) => {
    await mediaService.removeDownload(req.params.id, req.user!.userId);
    ok(req, res, { removed: true });
  }),
};
