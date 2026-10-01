import { Router } from "express";
import { searchController } from "../controllers/search.controller";
import { optionalAuth } from "../middlewares/authMiddleware";
import { rateLimit } from "../middlewares/rateLimit";
import { env } from "../config/env";

export const searchRouter = Router();
searchRouter.get("/search", optionalAuth, rateLimit("search", env.rateLimit.maxDefault, env.rateLimit.windowSec), searchController.search);
