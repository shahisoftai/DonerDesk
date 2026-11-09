import { resolveFieldRef, sharedJoins, sourceOf } from "./catalogue.js";
import { calculatedProblems, type CalculatedField } from "./calculated.js";

/**
 * A question put to the catalogue. One shape for every block: which source, which measures, grouped by what, filtered how. It
 * carries no data. `validateVisualQuery` is the one place the honesty rules for asking are decided, so a chart, a table and a
 * map refuse the same questions for the same reasons.
 */
export const AGGREGATES = ["SUM", "VALUE", "LATEST"] as const;
export type Aggregate = (typeof AGGREGATES)[number];

export interface VisualFilter { field: string; values: string[] }

export interface VisualQuery {
  source: string;
  /** Measure fields; a "source.field" reads a measure from a joined source. */
  measures: string[];
  groupBy: string[];
  filters?: VisualFilter[] | undefined;
  /** How a measure is combined across the rows of a group; absent = SUM for an additive measure, VALUE (as recorded) otherwise. */
  aggregate?: Record<string, Aggregate> | undefined;
  calculated?: CalculatedField[] | undefined;
  fromPeriodId?: string | undefined;
  toPeriodId?: string | undefined;
  includeDraft: boolean;
  /** Needed when a money measure is asked for without grouping by currency. */
  currency?: string | undefined;
  limit?: number | undefined;
}

export const QUERY_PROBLEM_CODES = [
  "UNKNOWN_SOURCE", "UNKNOWN_FIELD", "NO_MEASURE", "MEASURE_AS_GROUP", "DIMENSION_AS_MEASURE", "JOIN_NOT_DECLARED",
  "RATE_SUMMED", "NOT_ADDITIVE_SUMMED", "MONEY_NEEDS_CURRENCY", "BAD_LIMIT", "BAD_FILTER", "CALCULATED_PROBLEM",
] as const;
export type QueryProblemCode = (typeof QUERY_PROBLEM_CODES)[number];
export interface QueryProblem { code: QueryProblemCode; path: string; message: string }

export const MAX_QUERY_ROWS = 5000;
const issue = (code: QueryProblemCode, path: string, message: string): QueryProblem => ({ code, path, message });

function checkRef(q: VisualQuery, ref: string, path: string, want: "MEASURE" | "DIMENSION", out: QueryProblem[]): void {
  const hit = resolveFieldRef(ref, q.source);
  if (!hit) { out.push(issue("UNKNOWN_FIELD", path, `"${ref}" is not a field the catalogue knows.`)); return; }
  if (hit.source !== q.source && !(hit.field.joinKey === "PROJECT") && sharedJoins(q.source, hit.source).length === 0) {
    out.push(issue("JOIN_NOT_DECLARED", path, `${sourceOf(hit.source)?.label ?? hit.source} cannot be combined with ${sourceOf(q.source)?.label ?? q.source}: they share nothing to join on.`));
  }
  if (want === "MEASURE" && hit.field.role !== "MEASURE") out.push(issue("DIMENSION_AS_MEASURE", path, `${hit.field.label} is a group, not a figure.`));
  if (want === "DIMENSION" && hit.field.role !== "DIMENSION") out.push(issue("MEASURE_AS_GROUP", path, `${hit.field.label} is a figure, not something to group by.`));
}

export function validateVisualQuery(q: VisualQuery): QueryProblem[] {
  const out: QueryProblem[] = [];
  if (!sourceOf(q.source)) return [issue("UNKNOWN_SOURCE", "source", `"${q.source}" is not a data source.`)];
  if (q.measures.length === 0 && (q.calculated ?? []).length === 0) out.push(issue("NO_MEASURE", "measures", "Choose at least one figure to show."));
  q.measures.forEach((m, i) => checkRef(q, m, `measures.${i}`, "MEASURE", out));
  q.groupBy.forEach((g, i) => checkRef(q, g, `groupBy.${i}`, "DIMENSION", out));
  (q.filters ?? []).forEach((f, i) => {
    const hit = resolveFieldRef(f.field, q.source);
    if (!hit) out.push(issue("UNKNOWN_FIELD", `filters.${i}`, `"${f.field}" is not a field the catalogue knows.`));
    else if (hit.field.role !== "DIMENSION" || f.values.length === 0) out.push(issue("BAD_FILTER", `filters.${i}`, `Filter ${hit.field.label} by one or more of its values.`));
  });
  for (const [ref, agg] of Object.entries(q.aggregate ?? {})) {
    const hit = resolveFieldRef(ref, q.source);
    if (!hit || hit.field.role !== "MEASURE") continue;
    if (agg === "SUM" && hit.field.type === "RATE") out.push(issue("RATE_SUMMED", `aggregate.${ref}`, `${hit.field.label} is a rate: it is shown as recorded and never added up.`));
    else if (agg === "SUM" && !hit.field.additive) out.push(issue("NOT_ADDITIVE_SUMMED", `aggregate.${ref}`, `${hit.field.label} cannot be added across rows (people may be counted more than once).`));
  }
  const moneyAsked = q.measures.some((m) => resolveFieldRef(m, q.source)?.field.money);
  const byCurrency = q.groupBy.some((g) => resolveFieldRef(g, q.source)?.field.joinKey === "CURRENCY");
  if (moneyAsked && !byCurrency && !q.currency) out.push(issue("MONEY_NEEDS_CURRENCY", "currency", "Money is never added across currencies: choose one currency, or group by currency."));
  if (q.limit !== undefined && (!Number.isInteger(q.limit) || q.limit < 1 || q.limit > MAX_QUERY_ROWS)) out.push(issue("BAD_LIMIT", "limit", `Ask for between 1 and ${MAX_QUERY_ROWS} rows.`));
  for (const p of calculatedProblems(q.calculated ?? [], q.measures.map((m) => m), q.source)) out.push(issue("CALCULATED_PROBLEM", p.path, p.message));
  return out;
}

/** Every source a query reads (its own and the ones its fields come from): the reader checks each source's permission. */
export function sourcesOf(q: VisualQuery): string[] {
  const refs = [...q.measures, ...q.groupBy, ...(q.filters ?? []).map((f) => f.field)];
  return [...new Set([q.source, ...refs.flatMap((r) => { const hit = resolveFieldRef(r, q.source); return hit ? [hit.source] : []; })])];
}

/** True when an outside guest on a share link may ask this query: every source it reads is open to guests. */
export const isGuestSafe = (q: VisualQuery): boolean => sourcesOf(q).every((s) => sourceOf(s)?.guest === true);
