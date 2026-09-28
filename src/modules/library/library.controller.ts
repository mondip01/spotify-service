import { Request, Response } from "express";
import { asyncHandler } from "../../shared/errors/errorHandler";
import { ok } from "../../shared/response";
import { libraryRepository } from "./library.repository";
import { cursorPaginationQuery } from "../../shared/validation/pagination";
import { catalogService } from "../catalog/catalog.service";

export const libraryController = {
  overview: asyncHandler(async (req: Request, res: Response) => {
    const type = req.query.type as string | undefined;
    ok(req, res, await libraryRepository.libraryOverview(req.user!.userId, type));
  }),

  likedSongs: asyncHandler(async (req: Request, res: Response) => {
    const { limit, cursor } = cursorPaginationQuery.parse(req.query);
    ok(req, res, await libraryRepository.likedTracksPage(req.user!.userId, limit, cursor));
  }),

  like: asyncHandler(async (req: Request, res: Response) => {
    // Confirms the track exists/is playable before creating the like relation.
    await catalogService.getTrack(req.params.id);
    const created = await libraryRepository.like(req.user!.userId, req.params.id);
    ok(req, res, { liked: true, alreadyLiked: !created });
  }),

  unlike: asyncHandler(async (req: Request, res: Response) => {
    await libraryRepository.unlike(req.user!.userId, req.params.id);
    ok(req, res, { liked: false });
  }),

  recentlyPlayed: asyncHandler(async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 20);
    ok(req, res, await libraryRepository.recentlyPlayed(req.user!.userId, limit));
  }),

  recordHistoryEvent: asyncHandler(async (req: Request, res: Response) => {
    const { trackId, sessionId, contextType, contextId, startedAt, playedSec, completed } = req.body;
    await libraryRepository.recordHistory({
      userId: req.user!.userId,
      trackId,
      sessionId,
      contextType,
      contextId: contextId ?? null,
      startedAt: new Date(startedAt),
      playedSec,
      completed,
    });
    ok(req, res, { recorded: true }, 201);
  }),
};
