import { randomUUID } from "node:crypto";
import type {
  WebhookEndpoint,
  WebhookEvent,
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookDispatchResult,
} from "./types.js";
import { computeWebhookSignature } from "./types.js";

const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [
  60_000,
  300_000,
  900_000,
  3_600_000,
  7_200_000,
];

export interface WebhookDeliveryStore {
  create(delivery: WebhookDelivery): Promise<void>;
  update(delivery: WebhookDelivery): Promise<void>;
  findById(id: string, tenantId: string): Promise<WebhookDelivery | null>;
  findPending(): Promise<WebhookDelivery[]>;
  findByWebhookId(webhookId: string, tenantId: string): Promise<WebhookDelivery[]>;
}

export interface WebhookStore {
  create(endpoint: WebhookEndpoint): Promise<void>;
  update(endpoint: WebhookEndpoint): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
  findById(id: string, tenantId: string): Promise<WebhookEndpoint | null>;
  findByTenantId(tenantId: string): Promise<WebhookEndpoint[]>;
  findByEvent(tenantId: string, event: WebhookEvent): Promise<WebhookEndpoint[]>;
}

export interface HttpClient {
  post(url: string, body: string, headers: Record<string, string>): Promise<{
    statusCode: number;
    body: string;
  }>;
}

export class WebhookDispatcher {
  constructor(
    private readonly webhookStore: WebhookStore,
    private readonly deliveryStore: WebhookDeliveryStore,
    private readonly httpClient: HttpClient,
  ) {}

  async dispatch(
    tenantId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<WebhookDispatchResult[]> {
    const endpoints = await this.webhookStore.findByEvent(tenantId, event);
    const results: WebhookDispatchResult[] = [];

    for (const endpoint of endpoints) {
      if (!endpoint.active || endpoint.tenantId !== tenantId) continue;
      assertSafeWebhookUrl(endpoint.url);
      if (Buffer.byteLength(endpoint.secret, "utf8") < 32) {
        throw new Error("Webhook signing secrets must contain at least 32 bytes");
      }

      const delivery = await this.createDelivery(endpoint, event, payload);
      const result = await this.deliver(endpoint, delivery);
      results.push(result);
    }

    return results;
  }

  private async createDelivery(
    endpoint: WebhookEndpoint,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<WebhookDelivery> {
    const delivery: WebhookDelivery = {
      id: randomUUID(),
      tenantId: endpoint.tenantId,
      webhookId: endpoint.id,
      event,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      createdAt: new Date(),
    };
    await this.deliveryStore.create(delivery);
    return delivery;
  }

  private async deliver(
    endpoint: WebhookEndpoint,
    delivery: WebhookDelivery,
  ): Promise<WebhookDispatchResult> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify(delivery.payload);
    const signature = computeWebhookSignature(body, endpoint.secret, timestamp);

    try {
      const response = await this.httpClient.post(endpoint.url, body, {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": timestamp,
        "X-Webhook-Event": delivery.event,
        "X-Webhook-Delivery-Id": delivery.id,
      });

      const updated: WebhookDelivery = {
        ...delivery,
        status: "delivered",
        attempts: delivery.attempts + 1,
        lastAttemptAt: new Date(),
        responseStatus: response.statusCode,
        deliveredAt: new Date(),
      };
      const successful = response.statusCode >= 200 && response.statusCode < 300;
      if (!successful) {
        await this.handleDeliveryError(
          delivery,
          `Webhook endpoint returned HTTP ${response.statusCode}`,
          response.statusCode,
        );
      } else {
        await this.deliveryStore.update(updated);
      }

      return {
        deliveryId: delivery.id,
        success: response.statusCode >= 200 && response.statusCode < 300,
        statusCode: response.statusCode,
      };
    } catch (err) {
      const updated = await this.handleDeliveryError(delivery, String(err));
      return {
        deliveryId: delivery.id,
        success: false,
        error: String(err),
      };
    }
  }

  private async handleDeliveryError(
    delivery: WebhookDelivery,
    error: string,
    responseStatus?: number,
  ): Promise<WebhookDelivery> {
    const newAttempts = delivery.attempts + 1;
    let status: WebhookDeliveryStatus = "retrying";

    if (newAttempts >= delivery.maxAttempts) {
      status = "failed";
    }

    const delayMs = RETRY_DELAYS_MS[Math.min(newAttempts - 1, RETRY_DELAYS_MS.length - 1)] ?? 3_600_000;
    const nextAttemptAt = new Date(Date.now() + delayMs);

    const updated: WebhookDelivery = {
      ...delivery,
      status,
      attempts: newAttempts,
      lastAttemptAt: new Date(),
      nextAttemptAt: status === "retrying" ? nextAttemptAt : undefined,
      errorMessage: error.slice(0, 500),
      responseStatus,
    };

    await this.deliveryStore.update(updated);
    return updated;
  }

  async retryPending(now = new Date()): Promise<WebhookDispatchResult[]> {
    const pending = await this.deliveryStore.findPending();
    const results: WebhookDispatchResult[] = [];
    for (const delivery of pending) {
      if (delivery.status !== "retrying" && delivery.status !== "pending") continue;
      if (delivery.nextAttemptAt && delivery.nextAttemptAt > now) continue;
      const endpoint = await this.webhookStore.findById(delivery.webhookId, delivery.tenantId);
      if (!endpoint || !endpoint.active || endpoint.tenantId !== delivery.tenantId) {
        await this.deliveryStore.update({
          ...delivery,
          status: "failed",
          nextAttemptAt: undefined,
          errorMessage: "Webhook endpoint is unavailable",
        });
        continue;
      }
      results.push(await this.deliver(endpoint, delivery));
    }
    return results;
  }
}

export class DefaultHttpClient implements HttpClient {
  async post(url: string, body: string, headers: Record<string, string>): Promise<{
    statusCode: number;
    body: string;
  }> {
    assertSafeWebhookUrl(url);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    });

    const responseBody = await response.text();
    return {
      statusCode: response.status,
      body: responseBody,
    };
  }
}

export function assertSafeWebhookUrl(value: string): void {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Webhook endpoints must use HTTPS without embedded credentials");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || isPrivateAddress(host)) {
    throw new Error("Webhook endpoint host is not allowed");
  }
}

function isPrivateAddress(host: string): boolean {
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}
