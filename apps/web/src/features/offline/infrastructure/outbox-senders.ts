import { createActivityAction } from "@/lib/actions/activities";
import { uploadEvidenceAction } from "@/lib/actions/evidence";
import { changePlanStatusAction, saveProgressAction } from "@/lib/actions/workplan";
import { submitCollectionRecordAction } from "@/lib/actions/collection";
import { bulkSaveIndicatorUpdatesAction, type BulkSaveRow } from "@/lib/actions/indicators";
import { guardNetwork } from "@/lib/shared/connectivity";
import { createActivitySender } from "../domain/activity-outbox";
import { createCollectionRecordSender } from "../domain/collection-outbox";
import { createIndicatorValuesSender } from "../domain/indicator-values-outbox";
import { createPlanStatusSender } from "../domain/plan-status-outbox";
import { createProgressSender } from "../domain/progress-outbox";
import type { OutboxSender } from "../domain/outbox";
import type { OutboxKindName } from "../domain/outbox-kinds";

/**
 * The sender for every outbox kind, built from the server actions: the one place that knows which action carries which kind. The
 * table is typed over `OutboxKindName`, so a kind without a sender is a compile error, and the provider no longer lists them itself.
 */
export const OUTBOX_SENDERS: Readonly<Record<OutboxKindName, () => OutboxSender>> = {
  activity: () =>
    createActivitySender({
      createActivity: (input, options) => guardNetwork(() => createActivityAction(input, options)),
      uploadEvidence: (form) => guardNetwork(() => uploadEvidenceAction(form)),
    }),
  "progress-log": () => createProgressSender({ save: (itemId, input) => guardNetwork(() => saveProgressAction(itemId, input)) }),
  "collection-record": () =>
    createCollectionRecordSender({
      uploadFile: (formId, file) =>
        guardNetwork(async () => {
          const body = new FormData();
          body.set("file", file);
          const response = await fetch(`/api/collection-forms/${encodeURIComponent(formId)}/files`, { method: "POST", body });
          const json = (await response.json().catch(() => null)) as { id?: string; title?: string; detail?: string } | null;
          if (response.ok && json?.id) return { ok: true as const, value: { id: json.id } };
          const message = json?.detail ?? json?.title ?? "That file could not be sent.";
          if (response.status === 401) return { ok: false as const, error: { kind: "unauthenticated" as const, message } };
          if (response.status >= 500 || response.status === 429) return { ok: false as const, error: { kind: "unavailable" as const, message, retryable: true } };
          return { ok: false as const, error: { kind: "validation" as const, message, fields: {} } };
        }),
      submit: (formId, input) => guardNetwork(() => submitCollectionRecordAction(formId, input)),
    }),
  "plan-status": () => createPlanStatusSender({ changeStatus: (itemId, input) => guardNetwork(() => changePlanStatusAction(itemId, input)) }),
  "indicator-values": () => createIndicatorValuesSender({ bulkSave: (periodId, rows) => guardNetwork(() => bulkSaveIndicatorUpdatesAction(periodId, rows as BulkSaveRow[])) }),
};

/** One sender that routes an entry to the sender for its kind; an unknown kind is parked with a plain sentence, never dropped. */
export function createOutboxSender(): OutboxSender {
  const built = new Map<string, OutboxSender>(Object.entries(OUTBOX_SENDERS).map(([kind, make]) => [kind, make()]));
  return (entry, save) =>
    built.get(entry.kind)?.(entry, save) ?? Promise.resolve({ kind: "rejected" as const, message: "This kind of saved record is no longer supported." });
}
