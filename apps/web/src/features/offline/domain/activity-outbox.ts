import type { Result } from "../../../lib/shared/result.ts";
import type { AppError } from "../../../lib/shared/app-error.ts";
import { activityEvidenceFormData, type FileSettings } from "../../activities/domain/activity-evidence.ts";
import type { OutboxEntry, OutboxSender, SendOutcome } from "./outbox.ts";

export const ACTIVITY_KIND = "activity";

export interface QueuedFile {
  name: string;
  type: string;
  blob: Blob;
  settings: FileSettings;
}

/** Everything needed to record an activity (and the proof dropped on it) later, exactly as the person filled it in. */
export interface ActivityOutboxPayload {
  projectId: string;
  reportingPeriodId: string;
  activityDate?: string;
  location?: string;
  /** The create input, as the create action takes it. */
  create: Record<string, unknown>;
  files: QueuedFile[];
  createdActivityId?: string;
  uploadedNames: string[];
}

export function activityEntry(input: { id: string; title: string; payload: Omit<ActivityOutboxPayload, "uploadedNames">; now: number }): OutboxEntry<ActivityOutboxPayload> {
  return {
    id: input.id,
    kind: ACTIVITY_KIND,
    title: input.title,
    payload: { ...input.payload, uploadedNames: [] },
    createdAt: input.now,
    attempts: 0,
    state: "waiting",
  };
}

/** The two server calls a send makes, passed in so the rule is testable without a server. */
export interface ActivitySendDeps {
  createActivity(input: unknown, options: { idempotencyKey: string }): Promise<Result<{ id: string }, AppError>>;
  uploadEvidence(formData: FormData): Promise<Result<unknown, AppError>>;
}

function toOutcome(error: AppError): SendOutcome {
  return error.kind === "unavailable" ? { kind: "offline", message: error.message } : { kind: "rejected", message: error.message };
}

/**
 * Records the activity (its id is the idempotency key, so repeating is safe), then uploads each file once. Progress is saved
 * after every step: if the connection drops after the activity is created, the retry uploads only what is missing. A file the
 * server refuses does not hold back the others; the entry is then parked with the names that did not go.
 */
export function createActivitySender(deps: ActivitySendDeps): OutboxSender {
  return async (entry, save) => {
    const payload = entry.payload as ActivityOutboxPayload;
    let activityId = payload.createdActivityId;
    let uploaded = [...payload.uploadedNames];

    if (!activityId) {
      const created = await deps.createActivity(payload.create, { idempotencyKey: entry.id });
      if (!created.ok) return toOutcome(created.error);
      activityId = created.value.id;
      await save({ payload: { ...payload, createdActivityId: activityId, uploadedNames: uploaded } });
    }

    const refused: string[] = [];
    for (const file of payload.files.filter((f) => !uploaded.includes(f.name))) {
      const form = activityEvidenceFormData(
        new File([file.blob], file.name, { type: file.type }),
        {
          projectId: payload.projectId,
          activityId,
          reportingPeriodId: payload.reportingPeriodId,
          ...(payload.activityDate ? { activityDate: payload.activityDate } : {}),
          ...(payload.location ? { location: payload.location } : {}),
        },
        file.settings,
      );
      const result = await deps.uploadEvidence(form);
      if (result.ok) {
        uploaded = [...uploaded, file.name];
        await save({ payload: { ...payload, createdActivityId: activityId, uploadedNames: uploaded } });
      } else if (result.error.kind === "unavailable") {
        return toOutcome(result.error);
      } else {
        refused.push(`${file.name} (${result.error.message})`);
      }
    }
    return refused.length === 0
      ? { kind: "sent" }
      : { kind: "rejected", message: `The activity was saved, but ${refused.length === 1 ? "this file was" : "these files were"} not uploaded: ${refused.join("; ")}` };
  };
}
