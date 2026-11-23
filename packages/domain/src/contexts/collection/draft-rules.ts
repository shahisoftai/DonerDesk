/**
 * Drafts of a long form (Phase 62.4). A draft belongs to one person, one form and one facility; it is not a record, is never counted
 * or reviewed, and expires after a stated number of days (with a reminder before). A save quotes the version it started from, so an
 * old phone cannot overwrite a newer copy silently. Pure: today is passed in.
 */
export const DRAFT_TTL_DAYS = 60;
export const DRAFT_REMIND_DAYS = 7;
export const MAX_DRAFT_BYTES = 2_000_000;

const DAY = 86_400_000;
const daysBetween = (from: Date, to: Date): number => Math.floor((to.getTime() - from.getTime()) / DAY);

export const draftExpiresOn = (lastSaved: Date): Date => new Date(lastSaved.getTime() + DRAFT_TTL_DAYS * DAY);
export const draftIsExpired = (lastSaved: Date, now: Date): boolean => daysBetween(lastSaved, now) >= DRAFT_TTL_DAYS;
export const draftNeedsReminder = (lastSaved: Date, now: Date): boolean => {
  const age = daysBetween(lastSaved, now);
  return age >= DRAFT_TTL_DAYS - DRAFT_REMIND_DAYS && age < DRAFT_TTL_DAYS;
};

export type DraftSaveRefusal = "CONFLICT" | "TOO_BIG";
export function checkDraftSave(stored: { updatedAt: Date } | undefined, expectedUpdatedAt: string | undefined, bytes: number): { ok: true } | { ok: false; refusal: DraftSaveRefusal } {
  if (bytes > MAX_DRAFT_BYTES) return { ok: false, refusal: "TOO_BIG" };
  if (stored && expectedUpdatedAt !== stored.updatedAt.toISOString()) return { ok: false, refusal: "CONFLICT" };
  return { ok: true };
}
