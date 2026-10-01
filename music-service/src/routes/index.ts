import { Router } from "express";
import { catalogRouter } from "./catalog.routes";
import { homeRouter } from "./home.routes";
import { libraryRouter } from "./library.routes";
import { playlistRouter } from "./playlist.routes";
import { playbackRouter } from "./playback.routes";
import { queueRouter } from "./queue.routes";
import { mediaRouter } from "./media.routes";
import { searchRouter } from "./search.routes";
import { analyticsRouter } from "./analytics.routes";
import { adminRouter } from "./admin.routes";
import { shareRouter } from "./share.routes";

// Section 7 "Complete API Blueprint" - every domain mounted under
// /api/v1, matching Appendix A/B exactly. No API Gateway in front of
// this (per section 2) - this router IS the entire public surface.
export const apiV1Router = Router();

apiV1Router.use("/home", homeRouter);
apiV1Router.use(catalogRouter);
apiV1Router.use(libraryRouter);
apiV1Router.use(playlistRouter);
apiV1Router.use(playbackRouter);
apiV1Router.use(queueRouter);
apiV1Router.use(mediaRouter);
apiV1Router.use(searchRouter);
apiV1Router.use(analyticsRouter);
apiV1Router.use(adminRouter);
apiV1Router.use(shareRouter);
