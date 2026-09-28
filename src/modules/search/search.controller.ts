import { Request, Response } from "express";
import { asyncHandler } from "../../shared/errors/errorHandler";
import { ok } from "../../shared/response";
import { searchService } from "./search.service";
import { AppError } from "../../shared/errors/AppError";

export const searchController = {
  search: asyncHandler(async (req: Request, res: Response) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 1) throw AppError.badRequest("MISSING_QUERY", "q query parameter is required");
    const type = (req.query.type as string) ?? "ALL";
    const limit = Number(req.query.limit ?? 20);
    const cursor = req.query.cursor as string | undefined;
    ok(req, res, await searchService.search(q, type as any, limit, cursor));
  }),
};
