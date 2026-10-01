import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { requireAuth } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/rbac";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin); // every /admin/* route requires an authenticated admin identity

adminRouter.post("/admin/artists", adminController.createArtist);
adminRouter.patch("/admin/artists/:id", adminController.updateArtist);

adminRouter.post("/admin/albums", adminController.createAlbum);
adminRouter.patch("/admin/albums/:id", adminController.updateAlbum);

adminRouter.post("/admin/tracks", adminController.createTrack);
adminRouter.patch("/admin/tracks/:id", adminController.updateTrack);
adminRouter.post("/admin/tracks/:id/publish", adminController.publishTrack);
adminRouter.post("/admin/tracks/:id/unpublish", adminController.unpublishTrack);
adminRouter.patch("/admin/tracks/:id/flags", adminController.setTrackFlags);

adminRouter.post("/admin/media/:id/reprocess", adminController.reprocessMedia);
adminRouter.get("/admin/jobs/:id", adminController.getJob);

