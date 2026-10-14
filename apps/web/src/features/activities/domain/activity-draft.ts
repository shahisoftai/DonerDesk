import { createDraftStore, type DraftStore, type KeyValueStorage } from "../../../lib/client/draft-store.ts";

/** The typed content of the new-activity form. Files are not kept: a browser cannot hold them across a reload. */
export const ACTIVITY_DRAFT_FIELDS = [
  "activityTitle",
  "activityDate",
  "activityEndDate",
  "location",
  "participantsTotal",
  "participantsMale",
  "participantsFemale",
  "participantsChildren",
  "participantsDisability",
  "logframeActivityId",
  "summary",
  "achievements",
  "challenges",
  "lessonsLearned",
  "nextSteps",
] as const;

export type ActivityDraft = Record<(typeof ACTIVITY_DRAFT_FIELDS)[number], string>;

export function emptyActivityDraft(): ActivityDraft {
  return Object.fromEntries(ACTIVITY_DRAFT_FIELDS.map((f) => [f, ""])) as ActivityDraft;
}

/** Unknown keys are dropped and non-text values become empty, so a stale or tampered draft cannot break the form. */
export function parseActivityDraft(raw: unknown): ActivityDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const draft = emptyActivityDraft();
  for (const field of ACTIVITY_DRAFT_FIELDS) {
    const value = source[field];
    if (typeof value === "string") draft[field] = value;
  }
  return draft;
}

export function hasActivityDraftInput(draft: ActivityDraft): boolean {
  return ACTIVITY_DRAFT_FIELDS.some((f) => draft[f].trim() !== "");
}

/** One draft per project, so two projects never offer each other's text. */
export function createActivityDraftStore(storage: KeyValueStorage | null, projectId: string): DraftStore<ActivityDraft> {
  return createDraftStore(storage, {
    key: `donordesk.activity-draft.${projectId}`,
    parse: parseActivityDraft,
    hasContent: hasActivityDraftInput,
  });
}
