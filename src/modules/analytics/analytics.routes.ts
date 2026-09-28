import { Router } from "express";
import { analyticsController } from "./analytics.controller";
import { optionalAuth } from "../../shared/auth/authMiddleware";

export const analyticsRouter = Router();
analyticsRouter.post("/analytics/events", optionalAuth, analyticsController.ingest);
