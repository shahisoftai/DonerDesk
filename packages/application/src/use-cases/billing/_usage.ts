import { createHash } from "node:crypto";
import type { UsageMetric } from "@donordesk/domain";

export const USAGE_METRIC_STORAGE: UsageMetric = "MANAGED_STORAGE_BYTES";
export const USAGE_METRIC_AI_CREDITS: UsageMetric = "AI_DRAFT_CREDITS";

/** UTC month start for usage buckets. */
export function monthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** UTC start of the month *after* `date`'s month (quota/grant reset boundary). */
export function nextMonthStartUtc(date: Date): Date {
  const start = monthStartUtc(date);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

/**
 * The address a mailbox really is, so one person cannot start a trial again as `name+2@…` or `n.a.m.e@gmail.com`: the `+tag` is dropped
 * everywhere, and for Gmail the dots in the name are ignored and googlemail.com is gmail.com.
 */
export function canonicalEmail(email: string): string {
  const lowered = email.trim().toLowerCase();
  const at = lowered.lastIndexOf("@");
  if (at === -1) return lowered;
  let local = lowered.slice(0, at).split("+")[0] ?? "";
  let domain = lowered.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** Normalized trial/email fingerprints for TrialIdentity abuse resistance. */
export function emailFingerprint(email: string): string {
  return sha256(canonicalEmail(email));
}

/** The fingerprint trials recorded before addresses were canonicalised were stored under; still checked, so an old trial still counts. */
export function legacyEmailFingerprint(email: string): string {
  return sha256(email.trim().toLowerCase());
}

export function domainFingerprint(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return sha256(at === -1 ? normalized : normalized.slice(at + 1));
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
