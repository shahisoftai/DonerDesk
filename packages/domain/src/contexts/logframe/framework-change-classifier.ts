import type { LogframeChange, LogframeChangeKind } from "./logframe-snapshot.js";

/**
 * Whether a change to the framework alters what is meant (the results and the reasoning between them) or how it is
 * measured (indicators, baselines, targets, means of verification). The table is keyed by every change kind, so a kind
 * added to the snapshot diff does not compile until it is placed here.
 */
export type FrameworkChangeKind = "STRUCTURE" | "MEASUREMENT";

export const FRAMEWORK_CHANGE_KINDS: Record<LogframeChangeKind, FrameworkChangeKind> = {
  ITEM_ADDED: "STRUCTURE",
  ITEM_REMOVED: "STRUCTURE",
  ITEM_CHANGED: "STRUCTURE",
  INDICATOR_ADDED: "MEASUREMENT",
  INDICATOR_REMOVED: "MEASUREMENT",
  INDICATOR_CHANGED: "MEASUREMENT",
};

export interface ClassifiedChanges {
  structure: LogframeChange[];
  measurement: LogframeChange[];
  /** Which kinds this set of changes touches, in a fixed order (strategic first). */
  kinds: FrameworkChangeKind[];
}

export function classifyFrameworkChange(changes: ReadonlyArray<LogframeChange>): ClassifiedChanges {
  const structure = changes.filter((c) => FRAMEWORK_CHANGE_KINDS[c.kind] === "STRUCTURE");
  const measurement = changes.filter((c) => FRAMEWORK_CHANGE_KINDS[c.kind] === "MEASUREMENT");
  const kinds: FrameworkChangeKind[] = [];
  if (structure.length > 0) kinds.push("STRUCTURE");
  if (measurement.length > 0) kinds.push("MEASUREMENT");
  return { structure, measurement, kinds };
}

/** The text stored with a version (`LogframeVersion.changeKinds`): comma separated, empty when nothing changed. */
export function formatChangeKinds(kinds: ReadonlyArray<FrameworkChangeKind>): string {
  return kinds.join(",");
}

export function parseChangeKinds(text: string | null | undefined): FrameworkChangeKind[] {
  return (text ?? "").split(",").filter((k): k is FrameworkChangeKind => k === "STRUCTURE" || k === "MEASUREMENT");
}
