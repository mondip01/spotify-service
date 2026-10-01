import { randomUUID } from 'node:crypto';
import { publishToQueue } from './publisher';
import { registerConsumer } from './consumer';

export interface QueueEnvelope<T> {
  eventId: string;
  correlationId: string;
  createdAt: string;
  schemaVersion: number;
  payload: T;
}

/** Company-standard producer wrapper: every message gets the common envelope. */
export async function publish<T>(queue: string, payload: T, correlationId?: string): Promise<void> {
  const envelope: QueueEnvelope<T> = {
    eventId: `evt_${randomUUID()}`,
    correlationId: correlationId ?? `corr_${randomUUID()}`,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    payload,
  };

  await publishToQueue(queue, JSON.stringify(envelope));
}

/** Company-standard consumer wrapper. The common consumer owns ack/error handling. */
export async function consume<T>(queue: string, handler: (envelope: QueueEnvelope<T>) => Promise<void>): Promise<void> {
  registerConsumer<QueueEnvelope<T>>({
    queue,
    assertOpts: { durable: true },
    handler,
  });
}

export const QUEUES = {
  MEDIA_METADATA: 'music.media.metadata',
  MEDIA_TRANSCODE: 'music.media.transcode',
  ANALYTICS_EVENTS: 'music.analytics.events',
  NOTIFICATION_EVENTS: 'music.notification.events',
} as const;
