import type { TenantId, WebhookEvent } from "@donordesk/domain";
import type { IAuditLogger } from "../ports/core.js";
import type { IWebhookEmitter } from "./report-notifier.js";

type AuditInput = Parameters<IAuditLogger["record"]>[0];

/**
 * Which audit events other systems are told about, and as what (Phase 33.7). The audit trail is already written at every place a
 * person verifies, accepts or seals something, so announcing from it means no path (a single action, a bulk action, a screen, an
 * import) can forget to. The payload is ids and a status only; the receiver fetches details with its own API key.
 */
const ANNOUNCED: ReadonlyArray<{ eventType: string; event: WebhookEvent; idKey: string; status: string }> = [
  { eventType: "logframe.indicator.verified", event: "indicator.value.verified", idKey: "indicatorUpdateId", status: "VERIFIED" },
  { eventType: "evidence.verified", event: "evidence.verified", idKey: "evidenceId", status: "VERIFIED" },
  { eventType: "evidence.verify", event: "evidence.verified", idKey: "evidenceId", status: "VERIFIED" },
  { eventType: "activity.accept", event: "activity.accepted", idKey: "activityId", status: "ACCEPTED" },
  { eventType: "report.submission.snapshot.created", event: "report.submitted", idKey: "submissionId", status: "SUBMITTED" },
];

export function webhookForAudit(input: Pick<AuditInput, "eventType" | "entityId" | "projectId">): { event: WebhookEvent; data: Record<string, unknown> } | null {
  const hit = ANNOUNCED.find((a) => a.eventType === input.eventType);
  if (!hit || !input.entityId) return null;
  return { event: hit.event, data: { [hit.idKey]: input.entityId, ...(input.projectId ? { projectId: input.projectId } : {}), status: hit.status } };
}

/**
 * The same audit logger, plus an announcement to subscribed webhooks after the event is written. Announcing never fails or delays
 * the change (the dispatcher swallows its own errors) and nothing is announced if the audit write itself failed.
 */
export function withWebhookEmission<T extends IAuditLogger>(audit: T, emitter: IWebhookEmitter): T {
  return new Proxy(audit, {
    get(target, prop, receiver) {
      if (prop !== "record") return Reflect.get(target, prop, receiver);
      return async (input: AuditInput): Promise<void> => {
        await target.record(input);
        const announce = webhookForAudit(input);
        if (announce) await emitter.emit(input.tenantId as TenantId, announce.event, announce.data);
      };
    },
  });
}
