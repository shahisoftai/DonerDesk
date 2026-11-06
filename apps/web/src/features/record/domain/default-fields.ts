/**
 * Which fields a Record form shows at once and which wait under "Add detail" (Phase 44). One table, so a form cannot quietly grow a
 * sixth field on the first screen: `DEFAULT_FIELD_LIMIT` is the rule and the test holds every kind to it.
 */
import type { RecordKindKey } from "./record-kinds.ts";

/** Five fields or fewer before Save. */
export const DEFAULT_FIELD_LIMIT = 5;

export type FieldKey =
  | "indicator" | "value" | "day" | "breakdown" | "source" | "note" | "file"
  | "title" | "where" | "people" | "photos" | "story" | "groups" | "planLink" | "endDate"
  | "caption" | "fileType" | "confidentiality" | "proves" | "period"
  | "amount" | "purpose" | "receipt" | "vendor" | "category" | "budgetLine";

export interface FieldSplit {
  /** Shown on the first screen. */
  shown: readonly FieldKey[];
  /** Behind "Add detail", closed until opened. */
  detail: readonly FieldKey[];
}

export const DEFAULT_FIELDS: Readonly<Record<RecordKindKey, FieldSplit>> = {
  NUMBER: { shown: ["indicator", "value", "day"], detail: ["breakdown", "source", "note", "file"] },
  // The server requires an account of what happened, so it stays on the first screen; the optional counts of people wait under Add detail.
  ACTIVITY: { shown: ["title", "day", "where", "story", "photos"], detail: ["people", "groups", "planLink", "endDate"] },
  FILE: { shown: ["file", "caption"], detail: ["fileType", "confidentiality", "proves", "period"] },
  EXPENSE: { shown: ["amount", "purpose", "day", "receipt"], detail: ["vendor", "category", "budgetLine"] },
  // A collection form's questions are the form's own: they come from its definition, not from this table.
  FORM: { shown: [], detail: [] },
};

export function isShownFirst(kind: RecordKindKey, field: FieldKey): boolean {
  return DEFAULT_FIELDS[kind].shown.includes(field);
}
