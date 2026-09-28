import amqp, { Channel, ChannelModel } from "amqplib";
import { env } from "../../config/env";
import { logger } from "../logger";

// Underlying AMQP connection/channel management, with reconnect-on-drop.
// This file plus queueClient.ts together are "the reusable common queue
// package" referenced throughout the design doc - every producer/consumer
// in every module (and, in principle, every other microservice) goes
// through queueClient.ts rather than touching amqplib directly.
let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export async function getChannel(): Promise<Channel> {
  if (channel) return channel;

  connection = await amqp.connect(env.rabbitmqUrl);
  channel = await connection.createChannel();

  connection.on("close", () => {
    logger.warn("rabbitmq_connection_closed_will_reconnect");
    channel = null;
    connection = null;
    setTimeout(() => getChannel().catch((e) => logger.error({ e }, "rabbitmq_reconnect_failed")), 2000);
  });
  connection.on("error", (err) => logger.error({ err }, "rabbitmq_connection_error"));

  logger.info("rabbitmq_connected");
  return channel;
}

export async function closeRabbitMQ(): Promise<void> {
  await channel?.close();
  await connection?.close();
}
