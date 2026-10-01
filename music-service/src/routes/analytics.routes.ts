import { Router } from "express";
import { analyticsController } from "../controllers/analytics.controller";
import { optionalAuth } from "../middlewares/authMiddleware";

export const analyticsRouter = Router();
analyticsRouter.post("/analytics/events", optionalAuth, analyticsController.ingest);
