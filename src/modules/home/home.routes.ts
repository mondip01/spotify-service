import { Router } from "express";
import { homeController } from "./home.controller";
import { optionalAuth } from "../../shared/auth/authMiddleware";

export const homeRouter = Router();
homeRouter.get("/", optionalAuth, homeController.getHome);
homeRouter.get("/divine-picks", optionalAuth, homeController.getDivinePicks);
homeRouter.get("/trending", optionalAuth, homeController.getTrending);
