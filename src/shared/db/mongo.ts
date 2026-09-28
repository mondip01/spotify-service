import mongoose from "mongoose";
import { env } from "../../config/env";
import { logger } from "../logger";

export async function connectMongo(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri, {
    // Fail fast rather than hang - section 15: "Fail fast; do not create
    // fake success" for Mongo.
    serverSelectionTimeoutMS: 5000,
  });
  logger.info("mongo_connected");

  mongoose.connection.on("error", (err) => logger.error({ err }, "mongo_connection_error"));
  mongoose.connection.on("disconnected", () => logger.warn("mongo_disconnected"));
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
