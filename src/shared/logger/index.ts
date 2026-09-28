import pino from "pino";
import { config } from "@config/index";

// Structured JSON logs, as required by the design doc (Section 21 - Observability).
// requestId/correlationId are bound per-request in the http logger middleware (see http/requestContext.ts)
export const logger = pino({
  name: config.serviceName,
  level: config.env === "production" ? "info" : "debug",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});
