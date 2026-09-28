import { v4 as uuid } from "uuid";
import { getChannel } from "./rabbitmq";
import { logger } from "../logger";

// The generic envelope every message on every queue must carry
// (section 13): "Messages must contain eventId/jobId, correlationId,
// createdAt and schemaVersion."
export interface QueueEnvelope<T> {
  eventId: string;
  correlationId: string;
  createdAt: string;
  schemaVersion: number;
  payload: T;
}

const EXCHANGE = "music.events"; // topic exchange; routingKey === queue name for simplicity
const DLX = "music.dlx";
const DLQ = "music.dlq";
const MAX_ATTEMPTS = 5;

async function ensureTopology(): Promise<void> {
  const ch = await getChannel();
  await ch.assertExchange(EXCHANGE, "topic", { durable: true });
  await ch.assertExchange(DLX, "topic", { durable: true });
  await ch.assertQueue(DLQ, { durable: true });
  await ch.bindQueue(DLQ, DLX, "#");
}

/** Publish a payload onto a named queue/routing key with the standard envelope. */
export async function publish<T>(routingKey: string, payload: T, correlationId?: string): Promise<void> {
  await ensureTopology();
  const ch = await getChannel();

  const envelope: QueueEnvelope<T> = {
    eventId: `evt_${uuid()}`,
    correlationId: correlationId ?? `corr_${uuid()}`,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    payload,
  };

  ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(envelope)), {
    persistent: true, // durable messages, per section 13
    contentType: "application/json",
  });

  logger.debug({ routingKey, eventId: envelope.eventId }, "queue_published");
}

/**
 * Subscribe to a named queue. The handler MUST be idempotent (section 13:
 * "Consumers must be idempotent because RabbitMQ delivery can be
 * repeated"). On failure the message is retried up to MAX_ATTEMPTS via a
 * requeue-with-counter header, then routed to the DLQ - "poison messages
 * go to DLQ rather than retrying forever."
 */
export async function consume<T>(
  queueName: string,
  routingKey: string,
  handler: (envelope: QueueEnvelope<T>) => Promise<void>
): Promise<void> {
  await ensureTopology();
  const ch = await getChannel();

  await ch.assertQueue(queueName, {
    durable: true,
    deadLetterExchange: DLX,
    deadLetterRoutingKey: queueName,
  });
  await ch.bindQueue(queueName, EXCHANGE, routingKey);
  await ch.prefetch(10);

  await ch.consume(queueName, async (msg) => {
    if (!msg) return;
    const attempts = (msg.properties.headers?.["x-attempts"] as number) ?? 0;

    try {
      const envelope = JSON.parse(msg.content.toString()) as QueueEnvelope<T>;
      await handler(envelope);
      ch.ack(msg);
    } catch (err) {
      logger.error({ err, queueName, attempts }, "queue_consumer_failed");

      if (attempts + 1 >= MAX_ATTEMPTS) {
        logger.error({ queueName }, "queue_message_moved_to_dlq");
        ch.nack(msg, false, false); // triggers dead-lettering, no requeue
        return;
      }

      ch.ack(msg); // ack original, republish with incremented attempt counter (manual bounded retry)
      ch.publish(EXCHANGE, routingKey, msg.content, {
        persistent: true,
        headers: { "x-attempts": attempts + 1 },
      });
    }
  });

  logger.info({ queueName, routingKey }, "queue_consumer_started");
}

export const QUEUES = {
  MEDIA_METADATA: "music.media.metadata",
  MEDIA_TRANSCODE: "music.media.transcode",
  ANALYTICS_EVENTS: "music.analytics.events",
  NOTIFICATION_EVENTS: "music.notification.events",
} as const;
