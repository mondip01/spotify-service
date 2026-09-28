import { Router } from "express";
import { catalogRouter } from "../modules/catalog/catalog.routes";
import { homeRouter } from "../modules/home/home.routes";
import { podcastRouter } from "../modules/podcast/podcast.routes";
import { libraryRouter } from "../modules/library/library.routes";
import { playlistRouter } from "../modules/playlist/playlist.routes";
import { playbackRouter } from "../modules/playback/playback.routes";
import { queueRouter } from "../modules/playback/queue.routes";
import { mediaRouter } from "../modules/media/media.routes";
import { lyricsRouter } from "../modules/lyrics/lyrics.routes";
import { searchRouter } from "../modules/search/search.routes";
import { subscriptionRouter } from "../modules/subscription/subscription.routes";
import { analyticsRouter } from "../modules/analytics/analytics.routes";
import { adminRouter } from "../modules/admin/admin.routes";
import { shareRouter } from "../modules/share/share.routes";

// Section 7 "Complete API Blueprint" - every domain mounted under
// /api/v1, matching Appendix A/B exactly. No API Gateway in front of
// this (per section 2) - this router IS the entire public surface.
export const apiV1Router = Router();

apiV1Router.use("/home", homeRouter);
apiV1Router.use(catalogRouter);
apiV1Router.use(podcastRouter);
apiV1Router.use(libraryRouter);
apiV1Router.use(playlistRouter);
apiV1Router.use(playbackRouter);
apiV1Router.use(queueRouter);
apiV1Router.use(mediaRouter);
apiV1Router.use(lyricsRouter);
apiV1Router.use(searchRouter);
apiV1Router.use(subscriptionRouter);
apiV1Router.use(analyticsRouter);
apiV1Router.use(adminRouter);
apiV1Router.use(shareRouter);
