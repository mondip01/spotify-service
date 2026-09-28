import { Router } from "express";
import { subscriptionController } from "./subscription.controller";
import { requireAuth } from "../../shared/auth/authMiddleware";
import { validate } from "../../shared/validation/validate";
import { z } from "zod";

// Section 7 footnote: "Subscription APIs are temporary. Payment Service
// becomes production source of truth later." Kept as its own module/
// route group so it is trivial to delete or point at Payment Service.
export const subscriptionRouter = Router();

subscriptionRouter.get("/subscription/plans", subscriptionController.plans);
subscriptionRouter.get("/subscription/me", requireAuth, subscriptionController.me);
subscriptionRouter.post(
  "/subscription/subscribe",
  requireAuth,
  validate({ body: z.object({ planCode: z.string() }) }),
  subscriptionController.subscribe
);
subscriptionRouter.post("/subscription/cancel", requireAuth, subscriptionController.cancel);
