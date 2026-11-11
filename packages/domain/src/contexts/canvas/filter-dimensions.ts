/**
 * The filter bar's dimensions as one table (Phase 50.3, the Power BI slicer): how each is offered, whether it nests (province, then
 * district), whether it may be used through a share link, and how a viewer's choice is written into a page address. Pure.
 *
 * A filter is never stored in a canvas: it lives in the address (`?f=`) so a view can be shared or bookmarked, and clearing it gives
 * back the canvas as saved. Money words (donor, funding source) never pass through a share link.
 */
import type { FilterDimension } from "./filters.js";
import { FILTER_DIMENSIONS } from "./filters.js";

export const FILTER_CONTROL_STYLES = ["DROPDOWN", "LIST", "TILES", "BUTTONS"] as const;
export type FilterControlStyle = (typeof FILTER_CONTROL_STYLES)[number];

export interface FilterDimensionDef { labelKey: string; hierarchical: boolean; multi: boolean; viaShareLink: boolean; relative: boolean; boolean: boolean }

export const FILTER_DIMENSION_DEFS: Readonly<Record<FilterDimension, FilterDimensionDef>> = {
  PERIOD: { labelKey: "filter.PERIOD", hierarchical: false, multi: false, viaShareLink: true, relative: true, boolean: false },
  PROJECT: { labelKey: "filter.PROJECT", hierarchical: false, multi: true, viaShareLink: false, relative: false, boolean: false },
  PLACE: { labelKey: "filter.PLACE", hierarchical: true, multi: true, viaShareLink: true, relative: false, boolean: false },
  SECTOR: { labelKey: "filter.SECTOR", hierarchical: false, multi: true, viaShareLink: true, relative: false, boolean: false },
  STATUS: { labelKey: "filter.STATUS", hierarchical: false, multi: true, viaShareLink: true, relative: false, boolean: false },
  DRAFTS: { labelKey: "filter.DRAFTS", hierarchical: false, multi: false, viaShareLink: false, relative: false, boolean: true },
  DONOR: { labelKey: "filter.DONOR", hierarchical: false, multi: true, viaShareLink: false, relative: false, boolean: false },
  FUNDING_SOURCE: { labelKey: "filter.FUNDING_SOURCE", hierarchical: false, multi: true, viaShareLink: false, relative: false, boolean: false },
  PARTNER: { labelKey: "filter.PARTNER", hierarchical: false, multi: true, viaShareLink: false, relative: false, boolean: false },
};

/** How one filter is shown on the bar. */
export interface FilterControl { dimension: FilterDimension; style?: FilterControlStyle; multi?: boolean; search?: boolean; selectAll?: boolean; selectedFirst?: boolean; label?: string; /** PLACE only: the admin levels offered, top first ([1, 2] = province then district). */ levels?: number[] }
export interface FilterBarOptions { clearAll?: boolean; applyButton?: boolean; /** Choices narrow each other (a district list follows the province chosen). */ cascade?: boolean; /** One choice applies to every page of the canvas. */ syncPages?: boolean }

export function filterControlProblems(c: FilterControl): string[] {
  const def = FILTER_DIMENSION_DEFS[c.dimension];
  if (!def) return ["That filter is not offered."];
  const out: string[] = [];
  if (c.style !== undefined && !FILTER_CONTROL_STYLES.includes(c.style)) out.push("Unknown filter style.");
  if (c.multi && !def.multi) out.push("This filter takes one choice.");
  if (c.levels !== undefined) {
    if (!def.hierarchical) out.push("Only places have levels.");
    else if (c.levels.length === 0 || c.levels.length > 4 || c.levels.some((l) => !Number.isInteger(l) || l < 0 || l > 4) || c.levels.some((l, i) => i > 0 && l <= c.levels![i - 1]!)) out.push("Place levels go from 0 (country) to 4 (site), top first, each once.");
  }
  if ((c.label?.length ?? 0) > 40) out.push("A filter label is at most 40 characters.");
  return out;
}

// ---- the viewer's choice ----

/** What a viewer has chosen: a list of keys per dimension (one for a single-choice filter), a relative period, or the drafts switch. */
export type FilterSelection = Partial<Record<FilterDimension, string[]>> & { relativePeriod?: RelativePeriod };
export const RELATIVE_PERIODS = ["LATEST", "LAST_3", "LAST_6", "THIS_YEAR", "LAST_YEAR"] as const;
export type RelativePeriod = (typeof RELATIVE_PERIODS)[number];

/** The periods a relative choice means, from the periods the project has (sorted by start) and today's date. Recomputed on every open. */
export function relativePeriodIds(periods: ReadonlyArray<{ id: string; startDate: string; endDate: string }>, choice: RelativePeriod, today: string): string[] {
  const ended = periods.filter((p) => p.endDate.slice(0, 10) <= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const year = Number(today.slice(0, 4));
  switch (choice) {
    case "LATEST": return ended.slice(-1).map((p) => p.id);
    case "LAST_3": return ended.slice(-3).map((p) => p.id);
    case "LAST_6": return ended.slice(-6).map((p) => p.id);
    case "THIS_YEAR": return periods.filter((p) => Number(p.startDate.slice(0, 4)) === year && p.startDate.slice(0, 10) <= today).map((p) => p.id);
    case "LAST_YEAR": return periods.filter((p) => Number(p.startDate.slice(0, 4)) === year - 1).map((p) => p.id);
  }
}

/** Clicking a choice: a single-choice filter replaces, a multi-choice one toggles; choosing every option is the same as none (Select all = no filter). */
export function toggleChoice(sel: FilterSelection, dimension: FilterDimension, key: string, opts: { multi: boolean; optionCount: number }): FilterSelection {
  const now = sel[dimension] ?? [];
  let next = opts.multi ? (now.includes(key) ? now.filter((k) => k !== key) : [...now, key].sort()) : now[0] === key ? [] : [key];
  if (opts.multi && opts.optionCount > 0 && next.length >= opts.optionCount) next = [];
  const out: FilterSelection = { ...sel };
  if (next.length === 0) delete out[dimension]; else out[dimension] = next;
  if (dimension === "PERIOD") delete out.relativePeriod;
  return out;
}

export const clearAll = (): FilterSelection => ({});

/** A place choice at a lower level stays only while it sits inside the higher one chosen (cascade). */
export function cascadePlaces(sel: FilterSelection, tree: ReadonlyArray<{ key: string; parentKey: string | null }>, upperKeys: readonly string[]): string[] {
  if (upperKeys.length === 0) return sel.PLACE ?? [];
  const parent = new Map(tree.map((t) => [t.key, t.parentKey] as const));
  const inside = (k: string): boolean => { let p: string | null | undefined = k; for (let i = 0; i < 6 && p; i++) { if (upperKeys.includes(p)) return true; p = parent.get(p); } return false; };
  return (sel.PLACE ?? []).filter(inside);
}

/** The options a lower place level offers once a higher one is chosen. */
export const placeOptionsUnder = <T extends { key: string; parentKey: string | null }>(options: readonly T[], tree: ReadonlyArray<{ key: string; parentKey: string | null }>, upperKeys: readonly string[]): T[] =>
  upperKeys.length === 0 ? [...options] : options.filter((o) => cascadePlaces({ PLACE: [o.key] }, tree, upperKeys).length === 1);

/** Drops what may not travel: everything a share link may not filter by. */
export function forShareLink(sel: FilterSelection): FilterSelection {
  const out: FilterSelection = {};
  for (const d of FILTER_DIMENSIONS) if (sel[d] && FILTER_DIMENSION_DEFS[d].viaShareLink) out[d] = sel[d];
  if (sel.relativePeriod) out.relativePeriod = sel.relativePeriod;
  return out;
}

// ---- the page address ----
const SEP = "~";
/** `PLACE:punjab,sindh~PERIOD:p3~rel:LAST_3`; keys are URI-encoded, dimensions in a fixed order so one choice has one address. */
export function encodeFilterSelection(sel: FilterSelection): string {
  const parts: string[] = [];
  for (const d of FILTER_DIMENSIONS) { const v = sel[d]; if (v && v.length) parts.push(`${d}:${v.map(encodeURIComponent).join(",")}`); }
  if (sel.relativePeriod) parts.push(`rel:${sel.relativePeriod}`);
  return parts.join(SEP);
}

/** Reads an address back; anything unknown is dropped, never guessed. At most 50 keys per dimension. */
export function decodeFilterSelection(text: string | null | undefined): FilterSelection {
  const out: FilterSelection = {};
  if (!text) return out;
  for (const part of text.split(SEP).slice(0, 20)) {
    const i = part.indexOf(":");
    if (i < 1) continue;
    const head = part.slice(0, i), body = part.slice(i + 1);
    if (head === "rel") { if ((RELATIVE_PERIODS as readonly string[]).includes(body)) out.relativePeriod = body as RelativePeriod; continue; }
    if (!(FILTER_DIMENSIONS as readonly string[]).includes(head)) continue;
    let keys: string[];
    try { keys = body.split(",").map(decodeURIComponent).map((k) => k.trim()).filter((k) => k && k.length <= 120); } catch { continue; }
    if (keys.length) out[head as FilterDimension] = [...new Set(keys)].slice(0, 50).sort();
  }
  return out;
}
