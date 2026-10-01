import { createApp } from "./app";
import { env } from "./config/env";
import { connectMongo } from "./infra/mongo";
import { logger } from "./utils/logger";
import { registerGracefulShutdown } from "./lifecycle/gracefulShutdown";

async function main() {
  await connectMongo();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info({ port: env.port }, "music_service_listening");
  });

  registerGracefulShutdown(server);
}

main().catch((err) => {
  logger.error({ err }, "fatal_startup_error");
  process.exit(1);
});
