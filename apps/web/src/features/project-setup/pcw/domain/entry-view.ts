import type { CollectionMethod, SetupReviewMode } from "@donordesk/domain";
import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

export const METHOD_LABEL: Record<CollectionMethod, string> = {
  FORM: "A form in the field",
  CONNECTOR: "Another tool (KoboToolbox or SurveyCTO)",
  MANUAL: "Typed in",
  CALCULATED: "Worked out from other indicators",
};
export const METHODS = Object.keys(METHOD_LABEL) as CollectionMethod[];

export const REVIEW_LABEL: Record<SetupReviewMode, string> = {
  SIMPLE: "Simple: values are handed in as they are saved, and a person who can verify checks them when a file is attached",
  FULL: "Full: every value is handed in, then a reviewer verifies it",
};
export const REVIEW_MODES = Object.keys(REVIEW_LABEL) as SetupReviewMode[];

export interface MethodRow {
  code: string;
  title: string;
  method: CollectionMethod | "";
  suggestion: SetupDraftView["methodSuggestions"][number] | undefined;
}

/** One row per indicator with the method chosen, and the suggestion that is still open for it. */
export function methodRows(view: SetupDraftView): MethodRow[] {
  return view.indicators.flatMap((i) => {
    const v = i.value as { code: string | null; title: string | null };
    if (!v.code) return [];
    return [{ code: v.code, title: v.title ?? v.code, method: view.extras.indicatorSetup[v.code]?.method ?? "", suggestion: view.methodSuggestions.find((s) => s.indicatorCode === v.code) }];
  });
}

/** How many indicators will get a drafted form at launch. */
export const formCount = (view: SetupDraftView): number => methodRows(view).filter((r) => r.method === "FORM").length;

/** How many planned activities record who took part. */
export const participantActivities = (view: SetupDraftView): number => Object.values(view.extras.planSetup).filter((s) => s.recordsParticipants).length;

/** A whole number of days from 0 to 365, or null for anything else (an empty box is not 0). */
export function parseDays(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n <= 365 ? n : null;
}

/** The entry window to save, or the sentence that says what is wrong; nothing is saved from half an answer. */
export function windowPatch(opens: string, closes: string): { ok: true; windowRule: { opensDaysBefore: number; closesDaysAfter: number } } | { ok: false; reason: string } {
  const o = parseDays(opens);
  const c = parseDays(closes);
  if (o === null || c === null) return { ok: false, reason: "Enter both as whole numbers of days, from 0 to 365." };
  return { ok: true, windowRule: { opensDaysBefore: o, closesDaysAfter: c } };
}
