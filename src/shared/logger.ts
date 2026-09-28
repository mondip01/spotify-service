import pino from "pino";
import { env } from "../config/env";

// Structured JSON logs, as required by section 21 (Observability) of the
// design doc. Never log tokens/signed URLs/secrets - callers are
// responsible for redacting those before passing objects here.
export const logger = pino({
  name: env.serviceName,
  level: env.nodeEnv === "production" ? "info" : "debug",
  redact: ["req.headers.authorization", "*.token", "*.signedUrl", "*.secret"],
});
