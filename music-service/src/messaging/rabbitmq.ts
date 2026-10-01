import amqp, { type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager';
import config from '../config/config';
import logger from '../utils/logger';

let connection: AmqpConnectionManager | null = null;
let publisherChannel: ChannelWrapper | null = null;

const assertedQueues = new Set<string>();

export function getConnection(): AmqpConnectionManager {
  if (connection) return connection;

  connection = amqp.connect([config.RABBITMQ_URI], {
    connectionOptions: {
      clientProperties: {
        connection_name: `${config.SERVICE_NAME}-${config.ENV}`,
        service: config.SERVICE_NAME,
      },
    },
  });

  connection.on('connect', () => logger.info('Rabbitmq Connected'));
  connection.on('disconnect', ({ err }) => logger.warn({ err: err?.message }, 'Rabbitmq Disconnected'));
  connection.on('connectFailed', ({ err }) => logger.error({ err: err?.message }, 'Rabbitmq connection failed'));

  return connection;
}

export function getPublisherChannel(): ChannelWrapper {
  if (publisherChannel) return publisherChannel;
  publisherChannel = getConnection().createChannel({ json: false, setup: async () => {} });
  return publisherChannel;
}

export async function ensureQueue(queue: string): Promise<void> {
  if (assertedQueues.has(queue)) return;
  await getPublisherChannel().addSetup(async (ch) => {
    await ch.assertQueue(queue, { durable: true });
  });
  assertedQueues.add(queue);
}

export async function closeRabbitMQ(): Promise<void> {
  await publisherChannel?.close();
  publisherChannel = null;
  await connection?.close();
  connection = null;
  assertedQueues.clear();
}
