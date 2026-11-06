/**
 * Canvas filters (Phase 45.5). A filter is a named dimension with a value the viewer chose; a block honours only the
 * dimensions its slots declare (`SlotDef.honours`), so a filter never silently changes a block that cannot use it.
 */
import type { DatasetQuery } from "../reporting/dataset-query.js";
import type { BlockInstance, Canvas } from "./canvas.js";
import { definitionFor } from "./blocks/registry.js";

export type FilterDimension = "PERIOD" | "PROJECT" | "PLACE" | "SECTOR" | "STATUS" | "DRAFTS";
export const FILTER_DIMENSIONS: readonly FilterDimension[] = ["PERIOD", "PROJECT", "PLACE", "SECTOR", "STATUS", "DRAFTS"];
export interface FilterValues { PERIOD?: string; PROJECT?: string; PLACE?: string; SECTOR?: string; STATUS?: string; DRAFTS?: boolean }

/** The dimensions a block responds to: what its slots declare, plus the list of projects (which reads the viewer's whole portfolio, so it has no project slot). */
const LEGACY_HONOURS: Readonly<Record<string, readonly FilterDimension[]>> = { PROJECT_LIST: ["STATUS", "SECTOR"] };

export function honoursOf(block: Pick<BlockInstance, "kind">): FilterDimension[] {
  const def = definitionFor(block.kind);
  const fromSlots = new Set<FilterDimension>(def ? def.slots.flatMap((s) => s.honours) : []);
  for (const d of LEGACY_HONOURS[block.kind] ?? []) fromSlots.add(d);
  return FILTER_DIMENSIONS.filter((d) => fromSlots.has(d));
}

/** Which filters a page offers: only those at least one of its blocks responds to, in a fixed order. */
export function filtersOnPage(canvas: Canvas, pageId: string): FilterDimension[] {
  const page = canvas.pages.find((p) => p.id === pageId);
  const used = new Set((page?.blocks ?? []).filter((b) => !b.style?.hidden).flatMap((b) => honoursOf(b)));
  return FILTER_DIMENSIONS.filter((d) => used.has(d));
}

/** The words under a block saying what filters changed it ("responds to: period, drafts"). */
export const respondsTo = (block: Pick<BlockInstance, "kind">): FilterDimension[] => honoursOf(block);

/** A dataset query with the viewer's filters applied, only for the dimensions the block honours. */
export function applyFilters(query: DatasetQuery, block: Pick<BlockInstance, "kind">, values: FilterValues): DatasetQuery {
  const honours = new Set(honoursOf(block));
  return {
    ...query,
    ...(honours.has("PERIOD") && values.PERIOD ? { toPeriodId: values.PERIOD } : {}),
    ...(honours.has("DRAFTS") && values.DRAFTS !== undefined ? { includeDraft: values.DRAFTS } : {}),
  };
}

/** Clicking the same value again clears it; only a dimension some block honours can be set (cross-filter rule). */
export function nextCrossFilter(current: FilterValues, available: readonly FilterDimension[], dimension: FilterDimension, value: string): FilterValues {
  if (!available.includes(dimension)) return current;
  const next: Record<string, unknown> = { ...current };
  if (next[dimension] === value) delete next[dimension]; else next[dimension] = value;
  return next as FilterValues;
}
