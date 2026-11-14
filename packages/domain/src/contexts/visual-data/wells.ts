import { aggregateDef, defaultAggregate, type Aggregate } from "./aggregates.js";
import { resolveFieldRef, type Catalogue } from "./catalogue.js";
import type { CalculatedField } from "./calculated.js";
import type { VisualFilter, VisualQuery } from "./query.js";

/**
 * Field wells (Phase 54, §3.6): what a person drags into a visual. `WELL_DEFS` names, per visual family, its wells and what each takes;
 * `wellsToQuery` turns filled wells into the one `VisualQuery` every visual asks, so wells add no new query path and every honesty rule of
 * `validateVisualQuery` still applies. A field a well cannot take is refused with a reason (`wellRefusal`).
 */
export const VISUAL_FAMILIES = ["BAR", "STACKED_BAR", "LINE", "AREA", "PIE", "TABLE", "CARD", "MAP"] as const;
export type VisualFamily = (typeof VISUAL_FAMILIES)[number];

export const WELL_KEYS = ["AXIS", "VALUES", "LEGEND", "TOOLTIP", "SMALL_MULTIPLES", "LOCATION", "COLOUR", "ROWS", "COLUMNS"] as const;
export type WellKey = (typeof WELL_KEYS)[number];

export interface WellDef {
  key: WellKey;
  label: string;
  accepts: "GROUP" | "FIGURE" | "PLACE" | "ANY";
  max: number;
  required: boolean;
  /** A rate cannot be stacked or sliced: wells that add parts into a whole refuse one. */
  partsOfWhole?: boolean;
}

export interface VisualFamilyDef {
  key: VisualFamily;
  label: string;
  wells: readonly WellDef[];
  /** At most this many groups drawn before "and N more". */
  maxGroups: number;
  /** What kind of picture it is, for motion (a counter suits a card, a draw-in suits a line). */
  picture: "NUMBER" | "CHART_LINE" | "CHART_BAR" | "MAP" | "OTHER";
  /** A picture: a public design asks for a written description. A card or a table is its own text. */
  needsAlt: boolean;
  /** Values along an axis: may hold a reference line (slices, tables, cards and maps cannot). */
  references: boolean;
  /** With nothing on the axis, two or more figures become the slices (boys and girls as two columns). */
  slicesFromValues?: boolean;
}

const axis = (max = 1): WellDef => ({ key: "AXIS", label: "Axis", accepts: "GROUP", max, required: true });
const values = (max = 6, partsOfWhole = false): WellDef => ({ key: "VALUES", label: "Values", accepts: "FIGURE", max, required: true, partsOfWhole });
const legend: WellDef = { key: "LEGEND", label: "Legend", accepts: "GROUP", max: 1, required: false };
const tooltip: WellDef = { key: "TOOLTIP", label: "Tooltip", accepts: "FIGURE", max: 3, required: false };
const multiples: WellDef = { key: "SMALL_MULTIPLES", label: "Small multiples", accepts: "GROUP", max: 1, required: false };

export const VISUAL_FAMILY_DEFS: readonly VisualFamilyDef[] = [
  { key: "BAR", label: "Bars", maxGroups: 40, picture: "CHART_BAR", needsAlt: true, references: true, wells: [axis(), values(), legend, tooltip, multiples] },
  { key: "STACKED_BAR", label: "Stacked bars", maxGroups: 40, picture: "CHART_BAR", needsAlt: true, references: true, wells: [axis(), { ...values(6, true) }, { ...legend, partsOfWhole: true }, tooltip] },
  { key: "LINE", label: "Line", maxGroups: 60, picture: "CHART_LINE", needsAlt: true, references: true, wells: [axis(), values(), legend, tooltip, multiples] },
  { key: "AREA", label: "Area", maxGroups: 60, picture: "CHART_LINE", needsAlt: true, references: true, wells: [axis(), values(6, true), legend, tooltip] },
  { key: "PIE", label: "Pie or donut", maxGroups: 12, picture: "CHART_BAR", needsAlt: true, references: false, slicesFromValues: true, wells: [{ ...axis(), label: "Slices", required: false }, values(6, true), tooltip] },
  { key: "TABLE", label: "Table", maxGroups: 500, picture: "OTHER", needsAlt: false, references: false, wells: [{ key: "ROWS", label: "Rows", accepts: "GROUP", max: 3, required: true }, { key: "COLUMNS", label: "Columns", accepts: "GROUP", max: 1, required: false }, values(8)] },
  { key: "CARD", label: "Card", maxGroups: 1, picture: "NUMBER", needsAlt: false, references: false, wells: [values(4)] },
  { key: "MAP", label: "Map", maxGroups: 500, picture: "MAP", needsAlt: true, references: false, wells: [{ key: "LOCATION", label: "Location", accepts: "PLACE", max: 1, required: true }, { key: "COLOUR", label: "Colour", accepts: "ANY", max: 1, required: true }, tooltip] },
];
const FAMILY = new Map(VISUAL_FAMILY_DEFS.map((d) => [d.key, d]));
export const visualFamilyDef = (key: string): VisualFamilyDef | undefined => FAMILY.get(key as VisualFamily);

/** A field in a well, with how it is combined (figures only). */
export interface WellField { ref: string; aggregate?: Aggregate | undefined }
export type Wells = Partial<Record<WellKey, WellField[]>>;

/** Why a well cannot take this field, or undefined when it can. The sentence is shown where the field was dropped. */
export function wellRefusal(family: VisualFamily, well: WellKey, ref: string, source: string, cat?: Catalogue, already: Wells = {}): string | undefined {
  const def = visualFamilyDef(family)?.wells.find((w) => w.key === well);
  if (!def) return "This visual has no such well.";
  const hit = resolveFieldRef(ref, source, cat);
  if (!hit) return "This field is not in the dataset.";
  const f = hit.field;
  if ((already[well]?.length ?? 0) >= def.max) return `${def.label} takes ${def.max === 1 ? "one field" : `up to ${def.max} fields`}.`;
  if (def.accepts === "GROUP" && f.role !== "DIMENSION") return `${f.label} is a figure; ${def.label} takes something to group by.`;
  if (def.accepts === "PLACE" && f.type !== "PLACE") return `${f.label} is not a place.`;
  if (def.accepts === "FIGURE" && f.role !== "MEASURE" && f.role !== "DIMENSION") return `${f.label} cannot be shown as a figure.`;
  if (def.partsOfWhole && f.type === "RATE") return `${f.label} is a rate; it cannot be stacked or sliced into parts of a whole.`;
  return undefined;
}

/** The figure a group field becomes in VALUES: counted (how many districts), never shown as text. */
const figureAggregate = (ref: string, source: string, chosen: Aggregate | undefined, cat?: Catalogue): Aggregate => {
  const f = resolveFieldRef(ref, source, cat)?.field;
  if (chosen) return chosen;
  return f?.role === "DIMENSION" ? "COUNT_DISTINCT" : defaultAggregate(f);
};

/**
 * Filled wells as the one query (pure). Group wells become `groupBy` (axis, legend, rows, columns, small multiples, location), figure
 * wells become `measures` with their aggregate. COLOUR on a map is a figure or a group. The result still goes through
 * `validateVisualQuery`, so a refusal is the same sentence wherever the question came from.
 */
export function wellsToQuery(family: VisualFamily, wells: Wells, source: string, extra: { filters?: VisualFilter[]; calculated?: CalculatedField[]; includeDraft?: boolean; limit?: number } = {}, cat?: Catalogue): VisualQuery {
  const def = visualFamilyDef(family);
  const groupBy: string[] = [], measures: string[] = [], aggregate: Record<string, Aggregate> = {};
  for (const w of def?.wells ?? []) {
    for (const f of wells[w.key] ?? []) {
      const hit = resolveFieldRef(f.ref, source, cat);
      const asGroup = w.accepts === "GROUP" || w.accepts === "PLACE" || (w.accepts === "ANY" && hit?.field.role === "DIMENSION");
      if (asGroup) { if (!groupBy.includes(f.ref)) groupBy.push(f.ref); continue; }
      if (!measures.includes(f.ref)) measures.push(f.ref);
      const agg = figureAggregate(f.ref, source, f.aggregate, cat);
      if (agg !== defaultAggregate(hit?.field) || aggregateDef(agg)?.acceptsGroup) aggregate[f.ref] = agg;
    }
  }
  return {
    source, measures, groupBy, includeDraft: extra.includeDraft ?? true,
    ...(Object.keys(aggregate).length ? { aggregate } : {}),
    ...(extra.filters?.length ? { filters: extra.filters } : {}),
    ...(extra.calculated?.length ? { calculated: extra.calculated } : {}),
    limit: extra.limit ?? def?.maxGroups ?? 500,
  };
}

/** Missing required wells, as sentences ("Add a field to Axis"). */
export function wellGaps(family: VisualFamily, wells: Wells, calculated: readonly CalculatedField[] = []): string[] {
  const def = visualFamilyDef(family);
  const gaps = (def?.wells ?? []).filter((w) => w.required && (wells[w.key]?.length ?? 0) === 0 && !(w.key === "VALUES" && calculated.length > 0)).map((w) => `Add a field to ${w.label}.`);
  const slices = (wells.VALUES?.length ?? 0) + calculated.length;
  if (def?.slicesFromValues && (wells.AXIS?.length ?? 0) === 0 && slices < 2) gaps.push("Add a field to Slices, or two or more figures to Values.");
  if (def?.slicesFromValues && (wells.AXIS?.length ?? 0) > 0 && slices > 1) gaps.push("With slices on the axis, show one figure.");
  return gaps;
}

/**
 * Switching the visual keeps every field that fits a well of the new family (§3.6), moving it to the first well that takes it, and
 * names the ones dropped. Pure.
 */
export function switchFamily(from: VisualFamily, to: VisualFamily, wells: Wells, source: string, cat?: Catalogue): { wells: Wells; dropped: string[] } {
  void from;
  const next: Wells = {};
  const dropped: string[] = [];
  const all = Object.entries(wells).flatMap(([k, fs]) => (fs ?? []).map((f) => ({ from: k as WellKey, f })));
  for (const { from: was, f } of all) {
    const order = (visualFamilyDef(to)?.wells ?? []).slice().sort((a, b) => (a.key === was ? -1 : b.key === was ? 1 : 0));
    const fit = order.find((w) => !wellRefusal(to, w.key, f.ref, source, cat, next));
    if (fit) next[fit.key] = [...(next[fit.key] ?? []), f];
    else dropped.push(resolveFieldRef(f.ref, source, cat)?.field.label ?? f.ref);
  }
  return { wells: next, dropped };
}

/** "Suggest a visual" (§3.6): from what is in the wells, the family that shows it best. */
export function suggestFamily(wells: Wells, source: string, cat?: Catalogue): { family: VisualFamily; reason: string } {
  const fields = Object.values(wells).flatMap((fs) => fs ?? []).map((f) => resolveFieldRef(f.ref, source, cat)?.field).filter(Boolean);
  const groups = fields.filter((f) => f!.role === "DIMENSION");
  const figures = fields.filter((f) => f!.role === "MEASURE");
  if (groups.length === 0) return { family: "CARD", reason: "Only figures: a card shows them as headline numbers." };
  if (groups.some((g) => g!.type === "PLACE") && figures.length <= 1) return { family: "MAP", reason: "A place and one figure: a map shows where." };
  if (groups.some((g) => g!.type === "DATE")) return { family: "LINE", reason: "A period: a line shows the change over time." };
  if (groups.length >= 2 || figures.length > 3) return { family: "TABLE", reason: "Several groups or many figures read best as a table." };
  return { family: "BAR", reason: "Groups compared side by side read best as bars." };
}
