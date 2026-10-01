import { ensureQueue, getPublisherChannel } from './rabbitmq';
import logger from '../utils/logger';

export async function publishToQueue(queue: string, message: string): Promise<void> {
  try {
    await ensureQueue(queue);
    await getPublisherChannel().sendToQueue(queue, Buffer.from(message), { persistent: true });
    logger.info({ queue }, 'Message sent to queue');
  } catch (error: any) {
    logger.error({ err: error?.message, queue }, 'Error publishing message');
    throw error;
  }
}
