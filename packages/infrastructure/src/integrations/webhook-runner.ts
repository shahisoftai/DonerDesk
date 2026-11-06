import { lookup } from "node:dns/promises";
import {
  WEBHOOK_DISABLE_AFTER_FAILED_DELIVERIES, WEBHOOK_MAX_ATTEMPTS, WEBHOOK_TIMEOUT_MS, checkWebhookUrl, isPrivateAddress, signWebhook, webhookRetryDelaySeconds,
} from "@donordesk/domain";
import type { IWebhookRepository, ILogger } from "@donordesk/application";

export interface DeliveryOutcome {
  sent: number;
  delivered: number;
  retried: number;
  gaveUp: number;
}

type Resolve = (host: string) => Promise<string[]>;
type Post = (url: string, init: { headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ status: number }>;

const defaultResolve: Resolve = async (host) => (await lookup(host, { all: true })).map((a) => a.address);
const defaultPost: Post = (url, init) => fetch(url, { method: "POST", ...init, redirect: "manual" });

/**
 * Sends queued webhook deliveries (Phase 33.7). For each: the address is checked again and the name is resolved
 * and every address it resolves to must be public (a name can point inward); the body is signed; the request has
 * a short timeout and never follows a redirect. A 2xx is delivered; anything else waits longer each time and is
 * given up after WEBHOOK_MAX_ATTEMPTS; an endpoint whose deliveries keep failing is switched off, with the reason.
 */
export class WebhookDeliveryRunner {
  constructor(
    private readonly hooks: IWebhookRepository,
    private readonly logger: ILogger,
    private readonly resolve: Resolve = defaultResolve,
    private readonly post: Post = defaultPost,
    private readonly batch = 20,
  ) {}

  async runOnce(now: Date = new Date()): Promise<DeliveryOutcome> {
    const outcome: DeliveryOutcome = { sent: 0, delivered: 0, retried: 0, gaveUp: 0 };
    const due = await this.hooks.claimDue(now, this.batch, WEBHOOK_TIMEOUT_MS / 1000 + 60);
    for (const { delivery, endpoint } of due) {
      outcome.sent += 1;
      const attempts = delivery.attempts + 1;
      let statusCode: number | undefined;
      let error: string | undefined;
      if (!endpoint || !endpoint.enabled) {
        error = "The webhook was switched off or removed";
      } else {
        const url = checkWebhookUrl(endpoint.url);
        if (!url.ok) error = url.error.message;
        else {
          try {
            const addresses = await this.resolve(url.value.hostname.replace(/^\[|\]$/g, ""));
            if (addresses.length === 0 || addresses.some(isPrivateAddress)) error = "The address resolves to a private network";
            else {
              const body = delivery.payloadJson;
              const timestamp = Math.floor(now.getTime() / 1000);
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
              try {
                const res = await this.post(url.value.toString(), {
                  headers: { "content-type": "application/json", "user-agent": "DonorDesk-Webhooks/1", "x-donordesk-event": delivery.event, "x-donordesk-delivery": delivery.id, "x-donordesk-signature": signWebhook(endpoint.secret, timestamp, body) },
                  body, signal: controller.signal,
                });
                statusCode = res.status;
                if (res.status < 200 || res.status >= 300) error = `The receiver answered ${res.status}`;
              } finally {
                clearTimeout(timer);
              }
            }
          } catch (e) {
            error = e instanceof Error && e.name === "AbortError" ? "The receiver did not answer in time" : "The receiver could not be reached";
          }
        }
      }
      if (!error) {
        await this.hooks.recordAttempt({ deliveryId: delivery.id, status: "DELIVERED", attempts, nextAttemptAt: now, statusCode, deliveredAt: now, endpointId: delivery.endpointId, endpointFailed: false });
        outcome.delivered += 1;
        continue;
      }
      const giveUp = attempts >= WEBHOOK_MAX_ATTEMPTS || !endpoint || !endpoint.enabled;
      const disable = giveUp && endpoint && endpoint.enabled && endpoint.consecutiveFailures + 1 >= WEBHOOK_DISABLE_AFTER_FAILED_DELIVERIES ? `Switched off after ${WEBHOOK_DISABLE_AFTER_FAILED_DELIVERIES} failed deliveries in a row. Last problem: ${error}` : undefined;
      await this.hooks.recordAttempt({
        deliveryId: delivery.id, status: giveUp ? "FAILED" : "PENDING", attempts, nextAttemptAt: giveUp ? now : new Date(now.getTime() + webhookRetryDelaySeconds(attempts) * 1000),
        statusCode, error, endpointId: delivery.endpointId, endpointFailed: giveUp, disable,
      });
      if (giveUp) { outcome.gaveUp += 1; this.logger.warn("webhook.gave_up", { deliveryId: delivery.id, endpointId: delivery.endpointId, attempts, error }); } else outcome.retried += 1;
    }
    return outcome;
  }
}
