import { Request, Response } from "express";
import { asyncHandler } from "../../shared/errors/errorHandler";
import { ok } from "../../shared/response";
import { analyticsService } from "./analytics.service";

export const analyticsController = {
  ingest: asyncHandler(async (req: Request, res: Response) => {
    const result = await analyticsService.ingest({
      ...req.body,
      userId: req.user?.userId ?? null,
      occurredAt: req.body.occurredAt ?? new Date().toISOString(),
    });
    ok(req, res, result, 202);
  }),
};
