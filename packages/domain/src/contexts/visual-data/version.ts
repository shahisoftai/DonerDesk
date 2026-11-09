import { DATA_SOURCES } from "./catalogue.js";

/**
 * Live data (Phase 48.17). A project's sources carry a version that goes up when something that feeds them changes. An open
 * canvas asks for the versions cheaply and redraws only the blocks whose sources changed. The table below turns what the audit
 * trail announces into the sources it touches; it is the only place that knows which change touches which source.
 */
export type DataVersion = Readonly<Record<string, number>>;

/** Audit action prefix -> the sources a change of that kind can alter. Longest matching prefix wins. */
export const AUDIT_TO_SOURCES: ReadonlyArray<readonly [prefix: string, sources: readonly string[]]> = [
  ["logframe.indicator", ["indicator-values", "disaggregation", "results-by-place", "projects"]],
  ["logframe.", ["logframe", "indicator-values"]],
  ["indicator", ["indicator-values", "disaggregation", "results-by-place"]],
  ["activity.", ["activities", "plan", "reach", "results-by-place"]],
  ["plan.", ["plan"]],
  ["workplan.", ["plan"]],
  ["evidence.", ["evidence"]],
  ["finance.", ["funding", "spending", "projects"]],
  ["budget.", ["spending"]],
  ["funding.", ["funding", "programmes"]],
  ["report.", ["periods"]],
  ["period.", ["periods", "indicator-values"]],
  ["risk.", ["risks", "projects"]],
  ["task.", ["tasks"]],
  ["collection.", ["collection", "indicator-values"]],
  ["place.", ["results-by-place", "plan"]],
  ["beneficiary.", ["reach"]],
  ["project.", ["projects"]],
  ["library.", ["library"]],
];

export function sourcesTouchedBy(action: string): string[] {
  const hit = [...AUDIT_TO_SOURCES].filter(([p]) => action.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? [...hit[1]] : [];
}

/** A new version map with every touched source one higher; the old map is left alone. */
export function bumpVersion(current: DataVersion, sources: readonly string[]): DataVersion {
  const next: Record<string, number> = { ...current };
  for (const s of sources) next[s] = (next[s] ?? 0) + 1;
  return next;
}

export function changedSources(before: DataVersion, after: DataVersion): string[] {
  return DATA_SOURCES.map((s) => s.id).filter((id) => (before[id] ?? 0) !== (after[id] ?? 0));
}

/** The blocks that must be asked again: the ones that read at least one source that changed. */
export function blocksToRefresh(reads: ReadonlyMap<string, readonly string[]>, changed: readonly string[]): string[] {
  const set = new Set(changed);
  return [...reads].filter(([, sources]) => sources.some((s) => set.has(s))).map(([id]) => id);
}

/** "Updated 2 min ago" in numbers, so the screen words it in the person's language. */
export function ageOf(asOf: string, now: Date): { unit: "seconds" | "minutes" | "hours" | "days"; value: number } {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(asOf).getTime()) / 1000));
  if (seconds < 60) return { unit: "seconds", value: seconds };
  if (seconds < 3600) return { unit: "minutes", value: Math.round(seconds / 60) };
  if (seconds < 86400) return { unit: "hours", value: Math.round(seconds / 3600) };
  return { unit: "days", value: Math.round(seconds / 86400) };
}
