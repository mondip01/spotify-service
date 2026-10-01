import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import { logger } from "./utils/logger";
import { apiV1Router } from "./routes/index";
import { errorHandler, notFoundHandler } from "./errors/errorHandler";
import { isServiceReady } from "./lifecycle/gracefulShutdown";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  // Request/correlation IDs are attached by the shared request-context middleware.
  app.use((req, res, next) => {
    if (!req.headers["x-request-id"]) req.headers["x-request-id"] = `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    res.setHeader("x-request-id", String(req.headers["x-request-id"]));
    next();
  });
  app.use(pinoHttp({ logger }));

  // Liveness/readiness (section 21). No API Gateway in this design, so
  // these are hit directly by whatever orchestrates the container.
  app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));
  app.get("/readyz", (_req, res) => res.status(isServiceReady() ? 200 : 503).json({ status: isServiceReady() ? "ready" : "not_ready" }));

  app.use("/api/v1", apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
