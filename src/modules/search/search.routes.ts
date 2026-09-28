import { Router } from "express";
import { searchController } from "./search.controller";
import { optionalAuth } from "../../shared/auth/authMiddleware";
import { rateLimit } from "../../shared/rateLimit/rateLimit";
import { env } from "../../config/env";

export const searchRouter = Router();
searchRouter.get("/search", optionalAuth, rateLimit("search", env.rateLimit.maxDefault, env.rateLimit.windowSec), searchController.search);
