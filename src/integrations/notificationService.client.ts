import { env } from "../config/env";
import { createBreaker } from "../shared/circuitBreaker/breaker";
import { httpPost } from "./httpClient";
import { publish, QUEUES } from "../shared/queue/queueClient";
import { logger } from "../shared/logger";

// Section 3: "Music service emits event/request; it does not deliver
// itself." Preferred path is async (publish onto music.notification.events);
// a direct HTTP fallback exists for callers that need a synchronous
// best-effort attempt. Either way, a Notification Service failure must
// never fail the calling music operation (section 15).
export interface NotificationRequest {
  userId: string;
  type: "SUBSCRIPTION_EXPIRING" | "DOWNLOAD_READY" | "TRACK_PUBLISHED";
  data: Record<string, unknown>;
}

async function sendDirect(req: NotificationRequest): Promise<{ accepted: boolean }> {
  return httpPost(`${env.externalServices.notificationServiceBaseUrl}/internal/notifications`, req);
}

const breaker = createBreaker("notification-service", sendDirect, {
  onOpenFallback: async () => ({ accepted: false }),
});

export async function notifyAsync(req: NotificationRequest): Promise<void> {
  try {
    await publish(QUEUES.NOTIFICATION_EVENTS, req);
  } catch (err) {
    logger.warn({ err }, "notification_publish_failed_falling_back_to_direct_call");
    await breaker.fire(req).catch((e) => logger.error({ e }, "notification_direct_call_failed"));
  }
}
