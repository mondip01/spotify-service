import logger from '../utils/logger';
import { getConnection } from './rabbitmq';

export interface RegisterConsumerOptions<T> {
  queue: string;
  assertOpts?: Record<string, unknown>;
  prefetch?: number;
  handler: (payload: T, raw: unknown) => Promise<void>;
}

export function registerConsumer<T>({
  queue,
  assertOpts = {},
  prefetch = 10,
  handler,
}: RegisterConsumerOptions<T>) {
  const wrapper = getConnection().createChannel({
    json: false,
    setup: async (channel) => {
      logger.info({ queue, prefetch }, 'RabbitMQ consumer channel ready');
      await channel.prefetch(prefetch);
      await channel.assertQueue(queue, assertOpts as any);
      await channel.consume(queue, async (msg) => {
        if (msg === null) return;

        let payload: T;
        try {
          payload = JSON.parse(msg.content.toString()) as T;
        } catch (err: any) {
          logger.error({ err: err?.message, queue }, 'failed to parse message, dropping');
          channel.ack(msg);
          return;
        }

        try {
          await handler(payload, msg);
        } catch (err: any) {
          logger.error({ err: err?.message, queue }, 'consumer handler error');
        }

        channel.ack(msg);
      });
    },
  });

  wrapper.on('error', (err) => logger.error({ err: err?.message, queue }, 'RabbitMQ channel error'));
  return wrapper;
}
