import { v4 as uuid } from "uuid";
import { publish, QUEUES } from "../../shared/queue/queueClient";

// Section 7: "Ingest event; preferably queue immediately." The HTTP
// handler does the absolute minimum (assign an id if missing, publish)
// so client-facing latency stays flat regardless of downstream
// analytics load. The actual Mongo write happens in the worker.
export const analyticsService = {
  async ingest(event: Record<string, unknown>) {
    const eventId = (event.eventId as string) ?? `evt_${uuid()}`;
    await publish(QUEUES.ANALYTICS_EVENTS, { ...event, eventId });
    return { accepted: true, eventId };
  },
};
