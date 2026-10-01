import { Request, Response } from "express";
import { asyncHandler } from "../errors/errorHandler";
import { ok } from "../utils/response";
import { analyticsService } from "../services/analytics.service";

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
