import { Request, Response } from "express";
import { asyncHandler } from "../../shared/errors/errorHandler";
import { ok } from "../../shared/response";
import { catalogRepository } from "../catalog/catalog.repository";
import { withCache } from "../../shared/cache/cache";
import { getUserProfile } from "../../integrations/userService.client";

export const homeController = {
  getHome: asyncHandler(async (req: Request, res: Response) => {
    const segmentKey = req.user ? `personalized` : `anonymous`;

    const [featured, trending, recommended, profile] = await Promise.all([
      withCache(`music:home:divine-picks`, 180, () => catalogRepository.findFeatured(10)),
      withCache(`music:home:trending`, 180, () => catalogRepository.findTrending(10)),
      withCache(`music:home:recommended:${segmentKey}`, 180, () => catalogRepository.findRecommended(10)),
      req.user ? getUserProfile(req.user.userId) : Promise.resolve(null),
    ]);

    ok(req, res, {
      welcomeName: profile?.displayName ?? null,
      todaysDivinePicks: featured,
      trending,
      recommended,
    });
  }),

  getDivinePicks: asyncHandler(async (req: Request, res: Response) => {
    const items = await withCache("music:home:divine-picks", 180, () => catalogRepository.findFeatured(20));
    ok(req, res, items);
  }),

  getTrending: asyncHandler(async (req: Request, res: Response) => {
    const items = await withCache("music:home:trending", 180, () => catalogRepository.findTrending(20));
    ok(req, res, items);
  }),
};
