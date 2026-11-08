/**
 * What changed in a library entry since a project adopted it (Phase 46). The project's indicator is its own; this only lists the
 * differences between what the entry said then (the snapshot kept on the indicator) and what it says now, so a person can apply
 * a change or keep theirs. Nothing is overwritten by being compared. Pure.
 */
import { describeStandard } from "./reference-verdict.js";
import type { LibraryIndicator } from "./model.js";
import { snapshotOf, type LibraryLink, type LibrarySnapshot } from "./to-indicator-draft.js";

export type LibraryChangeField = keyof LibrarySnapshot;
export interface LibraryChange { field: LibraryChangeField; label: string; from: string; to: string }

export type LibraryUpdateState =
  | { state: "CURRENT" }
  | { state: "CHANGED"; version: number; changes: LibraryChange[] }
  | { state: "REPLACED"; replacedBy: string }
  | { state: "REMOVED" };

const LABEL: Readonly<Record<LibraryChangeField, string>> = {
  name: "Name", definition: "Definition", kind: "Kind", unit: "Unit", direction: "Which way is better", aggregation: "How periods combine",
  frequency: "How often", disaggregations: "Breakdowns", meansOfVerification: "How it is verified", referenceStandard: "Reference standard",
};

const text = (field: LibraryChangeField, snap: LibrarySnapshot): string => {
  const v = snap[field];
  if (field === "referenceStandard") return v ? describeStandard(v as NonNullable<LibrarySnapshot["referenceStandard"]>) : "none";
  if (Array.isArray(v)) return v.length > 0 ? v.join(", ").toLowerCase().replace(/_/g, " ") : "none";
  return String(v);
};

export function diffVersions(link: LibraryLink, current: LibraryIndicator | undefined, lookup: (id: string) => LibraryIndicator | undefined): LibraryUpdateState {
  if (!current) return { state: "REMOVED" };
  if (current.deprecatedBy && lookup(current.deprecatedBy)) return { state: "REPLACED", replacedBy: current.deprecatedBy };
  const now = snapshotOf(current);
  const changes: LibraryChange[] = [];
  for (const field of Object.keys(LABEL) as LibraryChangeField[]) {
    const a = text(field, link.snapshot);
    const b = text(field, now);
    if (a !== b) changes.push({ field, label: LABEL[field], from: a, to: b });
  }
  // Compared by content, not only by version: a reworded entry (the organisation's own wording included) shows as a difference too.
  return changes.length === 0 ? { state: "CURRENT" } : { state: "CHANGED", version: current.version, changes };
}
