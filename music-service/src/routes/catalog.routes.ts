import { Router } from "express";
import { catalogController } from "../controllers/catalog.controller";
import { optionalAuth } from "../middlewares/authMiddleware";

// Section 7 API blueprint - Catalog domain. Public/browsable, so
// optionalAuth only (personalization later if a user is present).
export const catalogRouter = Router();

catalogRouter.get("/artists", optionalAuth, catalogController.listArtists);
catalogRouter.get("/artists/:id", optionalAuth, catalogController.getArtist);
catalogRouter.get("/albums", optionalAuth, catalogController.listAlbums);
catalogRouter.get("/albums/:id", optionalAuth, catalogController.getAlbum);
catalogRouter.get("/tracks/:id", optionalAuth, catalogController.getTrack);
catalogRouter.get("/categories", optionalAuth, catalogController.listCategories);
catalogRouter.get("/categories/:id/tracks", optionalAuth, catalogController.getCategoryTracks);
