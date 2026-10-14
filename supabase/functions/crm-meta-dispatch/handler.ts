import { buildPayload, deliveryResult, eventProblem, readConfig, validWorkerToken, type QueuedEvent } from "./payload.ts";

export interface Queue {
  claim(): Promise<QueuedEvent[]>;
  finish(event: QueuedEvent, outcome: { status: string; code: string | null; delay: number }): Promise<boolean>;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export function createDispatchHandler(dependencies: {
  get: (key: string) => string | undefined;
  queue: () => Queue;
  fetch?: typeof fetch;
  now?: () => number;
}) {
  return async (request: Request) => {
    if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    const { get } = dependencies;
    if (!await validWorkerToken(request.headers.get("Authorization"), get("CRM_META_WORKER_SECRET"))) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }
    try {
      const config = readConfig(get);
      if (!config) return json({ status: "disabled", processed: 0 });
      const queue = dependencies.queue();
      const events = await queue.claim();
      let processed = 0;
      for (const event of events) {
        const problem = eventProblem(event, Math.floor((dependencies.now?.() ?? Date.now()) / 1000));
        let outcome;
        if (problem) {
          outcome = { status: problem === "EVENT_EXPIRED" ? "expired" : "failed", code: problem, delay: 0 };
        } else {
          try {
            const response = await (dependencies.fetch ?? fetch)(`https://graph.facebook.com/${config.graphVersion}/${config.datasetId}/events`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${config.token}`, "Content-Type": "application/json" },
              body: await buildPayload(event, config.testCode),
              signal: AbortSignal.timeout(15000),
            });
            const body = await response.json().catch(() => null);
            outcome = deliveryResult(response.status, body, event.attempts);
          } catch {
            outcome = deliveryResult(0, null, event.attempts);
          }
        }
        // A lost acknowledgement leaves the lease retryable with the same event ID.
        if (!await queue.finish(event, outcome)) return json({ error: "QUEUE_ACK_FAILED", processed }, 503);
        processed++;
      }
      return json({ processed });
    } catch {
      // Never return raw provider errors, tokens, request bodies or contact details.
      return json({ error: "CRM_DISPATCH_UNAVAILABLE" }, 503);
    }
  };
}
