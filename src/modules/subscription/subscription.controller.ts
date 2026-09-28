import { Request, Response } from "express";
import { asyncHandler } from "../../shared/errors/errorHandler";
import { ok } from "../../shared/response";
import { subscriptionService } from "./subscription.service";

export const subscriptionController = {
  plans: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await subscriptionService.listPlans());
  }),
  me: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await subscriptionService.myStatus(req.user!.userId));
  }),
  subscribe: asyncHandler(async (req: Request, res: Response) => {
    const { planCode } = req.body;
    ok(req, res, await subscriptionService.subscribe(req.user!.userId, planCode, req), 201);
  }),
  cancel: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await subscriptionService.cancel(req.user!.userId));
  }),
};
