import { createApp } from "./app";
import { env } from "./config/env";
import { connectMongo } from "./shared/db/mongo";
import { logger } from "./shared/logger";
import { getChannel } from "./shared/queue/rabbitmq";

async function main() {
  await connectMongo();
  await getChannel(); // fail fast if RabbitMQ is unreachable at boot

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info({ port: env.port }, "music_service_listening");
  });

  // Graceful shutdown (section 21).
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutdown_initiated");
    server.close(() => {
      logger.info("http_server_closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref(); // force-exit if close hangs
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "fatal_startup_error");
  process.exit(1);
});
