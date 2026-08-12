export type WebhookEvent =
  | "report.submitted"
  | "report.approved"
  | "report.returned"
  | "evidence.uploaded"
  | "evidence.verified"
  | "deadline.approaching"
  | "checklist.resolved"
  | "comment.added";

export type WebhookDeliveryStatus = "pending" | "delivered" | "failed" | "retrying";

export interface WebhookDelivery {
  id: string;
  tenantId: string;
  webhookId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  createdAt: Date;
  deliveredAt?: Date;
}

export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: Date;
}

export interface WebhookDispatchResult {
  deliveryId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

export interface WebhookSignature {
  timestamp: string;
  signature: string;
}

export function computeWebhookSignature(
  payload: string,
  secret: string,
  timestamp: string,
): string {
  const body = `${timestamp}.${payload}`;
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyWebhookSignature(
  payload: string,
  secret: string,
  timestamp: string,
  signature: string,
  toleranceSeconds = 300,
): boolean {
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0) return false;
  if (!/^\d+$/.test(timestamp) || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isSafeInteger(ts)) return false;
  if (Math.abs(now - ts) > toleranceSeconds) {
    return false;
  }
  const expected = computeWebhookSignature(payload, secret, timestamp);
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(signature, "hex");
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}
import { createHmac, timingSafeEqual } from "node:crypto";
