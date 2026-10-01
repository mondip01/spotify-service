import pino from "pino";
import { env } from "../config/env";

const logger = pino({
  name: env.serviceName,
  level: env.nodeEnv === "production" ? "info" : "debug",
  redact: ["req.headers.authorization", "*.token", "*.signedUrl", "*.secret"],
});

export { logger };
export default logger;
