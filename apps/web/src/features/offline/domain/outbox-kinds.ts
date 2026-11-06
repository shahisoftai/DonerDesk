/**
 * Every kind of record the outbox carries (Phase 44): the one list of names. The senders table is typed over it, so a kind added here
 * without a sender does not compile, and the Record kinds table is tested against it, so a kind cannot name an outbox kind that does
 * not exist.
 */
import { ACTIVITY_KIND } from "./activity-outbox.ts";
import { COLLECTION_RECORD_KIND } from "./collection-outbox.ts";
import { INDICATOR_VALUES_KIND } from "./indicator-values-outbox.ts";
import { PLAN_STATUS_KIND } from "./plan-status-outbox.ts";
import { PROGRESS_LOG_KIND } from "./progress-outbox.ts";

export const OUTBOX_KIND_NAMES = [ACTIVITY_KIND, PROGRESS_LOG_KIND, COLLECTION_RECORD_KIND, PLAN_STATUS_KIND, INDICATOR_VALUES_KIND] as const;

export type OutboxKindName = (typeof OUTBOX_KIND_NAMES)[number];

export function isOutboxKind(value: string): value is OutboxKindName {
  return (OUTBOX_KIND_NAMES as readonly string[]).includes(value);
}
