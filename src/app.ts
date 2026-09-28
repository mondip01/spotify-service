import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import { v4 as uuid } from "uuid";
import { logger } from "./shared/logger";
import { apiV1Router } from "./routes";
import { errorHandler, notFoundHandler } from "./shared/errors/errorHandler";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  // Every request gets a requestId/correlationId (section 21 Observability).
  app.use((req, _res, next) => {
    if (!req.headers["x-request-id"]) req.headers["x-request-id"] = `req_${uuid()}`;
    next();
  });
  app.use(pinoHttp({ logger }));

  // Liveness/readiness (section 21). No API Gateway in this design, so
  // these are hit directly by whatever orchestrates the container.
  app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));
  app.get("/readyz", (_req, res) => res.status(200).json({ status: "ready" }));

  app.use("/api/v1", apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
