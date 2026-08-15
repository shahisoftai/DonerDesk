import { createHash } from "node:crypto";
import type { UsageMetric } from "@donordesk/domain";

export const USAGE_METRIC_STORAGE: UsageMetric = "MANAGED_STORAGE_BYTES";
export const USAGE_METRIC_AI_CREDITS: UsageMetric = "AI_DRAFT_CREDITS";

/** UTC month start for usage buckets. */
export function monthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Normalized trial/email fingerprints for TrialIdentity abuse resistance. */
export function emailFingerprint(email: string): string {
  const normalized = email.trim().toLowerCase();
  return sha256(normalized);
}

export function domainFingerprint(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return sha256(at === -1 ? normalized : normalized.slice(at + 1));
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
