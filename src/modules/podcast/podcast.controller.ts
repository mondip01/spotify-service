import { Request, Response } from "express";
import { asyncHandler } from "../../shared/errors/errorHandler";
import { ok } from "../../shared/response";
import { podcastRepository } from "./podcast.repository";
import { AppError } from "../../shared/errors/AppError";

export const podcastController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await podcastRepository.findPodcasts(50));
  }),
  getById: asyncHandler(async (req: Request, res: Response) => {
    const podcast = await podcastRepository.findPodcastById(req.params.id);
    if (!podcast) throw AppError.notFound("PODCAST_NOT_FOUND", "Podcast not found");
    ok(req, res, podcast);
  }),
  episodes: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await podcastRepository.findEpisodes(req.params.id));
  }),
  follow: asyncHandler(async (req: Request, res: Response) => {
    await podcastRepository.follow(req.user!.userId, req.params.id);
    ok(req, res, { following: true });
  }),
  unfollow: asyncHandler(async (req: Request, res: Response) => {
    await podcastRepository.unfollow(req.user!.userId, req.params.id);
    ok(req, res, { following: false });
  }),
};
