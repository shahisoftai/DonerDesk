import type { FieldDef } from "./types.js";

/**
 * How a figure is combined across the rows of a group (Phase 48.17, rows added in Phase 54 §3.3). Each row declares what it accepts,
 * whether its result may be added again, and how it combines. `validateVisualQuery` and `shapeTable` read these rows; nothing
 * branches on an aggregate's name. A gap is never counted as 0: a group with nothing recorded is null.
 */
export type AggCell = string | number | null;
export interface Combined { value: number | null; mixed: boolean; partial: boolean }

export interface AggregateDef {
  key: string;
  label: string;
  /** Takes a group field too (counting places, partners): COUNT and COUNT_DISTINCT. */
  acceptsGroup: boolean;
  /** A sentence when this field cannot be combined this way; undefined when it can. `code` names the refusal. */
  refuse(field: FieldDef): { code: string; message: string } | undefined;
  /** The result can itself be added up across groups (a sum of sums; never a distinct count or an average). */
  additiveResult: boolean;
  /** The result may be a term of a calculated total or difference (a distinct count, an average or a lowest/highest may not). */
  summable: boolean;
  combine(cells: readonly AggCell[]): Combined;
}

const nums = (cells: readonly AggCell[]): { present: number[]; partial: boolean } => {
  const present = cells.filter((c): c is number => typeof c === "number" && Number.isFinite(c));
  return { present, partial: present.length > 0 && present.length < cells.length };
};
const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;
const none: Combined = { value: null, mixed: false, partial: false };
const numeric = (f: FieldDef) => (f.role !== "MEASURE" ? { code: "DIMENSION_AS_MEASURE", message: `${f.label} is a group, not a figure: count it instead.` } : undefined);

const rows = [
  {
    key: "SUM", label: "Add up", summable: true, acceptsGroup: false, additiveResult: true,
    refuse: (f: FieldDef) => numeric(f) ?? (f.type === "RATE" ? { code: "RATE_SUMMED", message: `${f.label} is a rate: it is shown as recorded and never added up.` } : !f.additive ? { code: "NOT_ADDITIVE_SUMMED", message: `${f.label} cannot be added across rows (people may be counted more than once).` } : undefined),
    combine: (cells: readonly AggCell[]) => { const { present, partial } = nums(cells); return present.length ? { value: r6(present.reduce((a, b) => a + b, 0)), mixed: false, partial } : none; },
  },
  {
    key: "VALUE", label: "As recorded", summable: true, acceptsGroup: false, additiveResult: false, refuse: numeric,
    // Shown only when the rows agree; two different figures are never averaged into a third.
    combine: (cells: readonly AggCell[]) => { const { present } = nums(cells); if (!present.length) return none; return new Set(present).size === 1 ? { value: present[0]!, mixed: false, partial: false } : { value: null, mixed: true, partial: false }; },
  },
  {
    key: "LATEST", label: "Latest", summable: true, acceptsGroup: false, additiveResult: false, refuse: numeric,
    combine: (cells: readonly AggCell[]) => { const { present } = nums(cells); return present.length ? { value: present[present.length - 1]!, mixed: false, partial: false } : none; },
  },
  {
    key: "COUNT", label: "Count rows", summable: true, acceptsGroup: true, additiveResult: true, refuse: () => undefined,
    combine: (cells: readonly AggCell[]) => ({ value: cells.filter((c) => c !== null && c !== "").length, mixed: false, partial: false }),
  },
  {
    key: "COUNT_DISTINCT", label: "Count different values", summable: false, acceptsGroup: true, additiveResult: false, refuse: () => undefined,
    combine: (cells: readonly AggCell[]) => ({ value: new Set(cells.filter((c) => c !== null && c !== "").map((c) => (typeof c === "string" ? c.trim().toLowerCase() : c))).size, mixed: false, partial: false }),
  },
  {
    key: "AVERAGE", label: "Average", summable: false, acceptsGroup: false, additiveResult: false,
    refuse: (f: FieldDef) => numeric(f) ?? (f.type === "RATE" ? { code: "AVERAGE_OF_RATE", message: `${f.label} is a rate: an average of rates misleads when the rows are of different sizes. Recompute it from its parts instead.` } : f.money ? { code: "AVERAGE_OF_MONEY", message: `${f.label} is money: add it up within one currency instead.` } : undefined),
    combine: (cells: readonly AggCell[]) => { const { present, partial } = nums(cells); return present.length ? { value: r6(present.reduce((a, b) => a + b, 0) / present.length), mixed: false, partial } : none; },
  },
  {
    key: "MIN", label: "Lowest", summable: false, acceptsGroup: false, additiveResult: false, refuse: numeric,
    combine: (cells: readonly AggCell[]) => { const { present } = nums(cells); return present.length ? { value: Math.min(...present), mixed: false, partial: false } : none; },
  },
  {
    key: "MAX", label: "Highest", summable: false, acceptsGroup: false, additiveResult: false, refuse: numeric,
    combine: (cells: readonly AggCell[]) => { const { present } = nums(cells); return present.length ? { value: Math.max(...present), mixed: false, partial: false } : none; },
  },
] as const satisfies readonly AggregateDef[];

export type Aggregate = (typeof rows)[number]["key"];
export const AGGREGATE_DEFS: readonly AggregateDef[] = rows;
export const AGGREGATES = rows.map((r) => r.key) as readonly Aggregate[];
const BY_KEY = new Map<string, AggregateDef>(rows.map((r) => [r.key, r]));
export const aggregateDef = (key: string): AggregateDef | undefined => BY_KEY.get(key);
/** The aggregate a field gets when none is chosen: add up what can be added, else as recorded. */
export const defaultAggregate = (f: FieldDef | undefined): Aggregate => (f?.role === "MEASURE" && f.additive ? "SUM" : f?.role === "DIMENSION" ? "COUNT_DISTINCT" : "VALUE");
