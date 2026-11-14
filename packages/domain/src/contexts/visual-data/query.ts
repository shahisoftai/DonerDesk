import { resolveFieldRef, sharedJoins, sourceOf, type Catalogue } from "./catalogue.js";
import { aggregateDef, type Aggregate } from "./aggregates.js";
import { calculatedProblems, type CalculatedField } from "./calculated.js";

/**
 * A question put to the catalogue. One shape for every block: which source, which measures, grouped by what, filtered how. It
 * carries no data. `validateVisualQuery` is the one place the honesty rules for asking are decided, so a chart, a table and a
 * map refuse the same questions for the same reasons.
 */
export { AGGREGATES, type Aggregate } from "./aggregates.js";

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
  "AVERAGE_OF_RATE", "AVERAGE_OF_MONEY", "COUNT_DISTINCT_SUMMED", "UNKNOWN_AGGREGATE",
] as const;
export type QueryProblemCode = (typeof QUERY_PROBLEM_CODES)[number];
export interface QueryProblem { code: QueryProblemCode; path: string; message: string }

export const MAX_QUERY_ROWS = 5000;
const issue = (code: QueryProblemCode, path: string, message: string): QueryProblem => ({ code, path, message });

function checkRef(q: VisualQuery, ref: string, path: string, want: "MEASURE" | "DIMENSION", out: QueryProblem[], cat?: Catalogue): void {
  const hit = resolveFieldRef(ref, q.source, cat);
  if (!hit) { out.push(issue("UNKNOWN_FIELD", path, `"${ref}" is not a field the catalogue knows.`)); return; }
  if (hit.source !== q.source && !(hit.field.joinKey === "PROJECT") && sharedJoins(q.source, hit.source, cat).length === 0) {
    out.push(issue("JOIN_NOT_DECLARED", path, `${sourceOf(hit.source, cat)?.label ?? hit.source} cannot be combined with ${sourceOf(q.source, cat)?.label ?? q.source}: they share nothing to join on.`));
  }
  // A group field may be counted (COUNT, COUNT_DISTINCT): the aggregate decides, not the role alone.
  const counted = aggregateDef(q.aggregate?.[ref] ?? "")?.acceptsGroup === true;
  if (want === "MEASURE" && hit.field.role !== "MEASURE" && !counted) out.push(issue("DIMENSION_AS_MEASURE", path, `${hit.field.label} is a group, not a figure.`));
  if (want === "DIMENSION" && hit.field.role !== "DIMENSION") out.push(issue("MEASURE_AS_GROUP", path, `${hit.field.label} is a figure, not something to group by.`));
}

export function validateVisualQuery(q: VisualQuery, cat?: Catalogue): QueryProblem[] {
  const out: QueryProblem[] = [];
  if (!sourceOf(q.source, cat)) return [issue("UNKNOWN_SOURCE", "source", `"${q.source}" is not a data source.`)];
  if (q.measures.length === 0 && (q.calculated ?? []).length === 0) out.push(issue("NO_MEASURE", "measures", "Choose at least one figure to show."));
  q.measures.forEach((m, i) => checkRef(q, m, `measures.${i}`, "MEASURE", out, cat));
  q.groupBy.forEach((g, i) => checkRef(q, g, `groupBy.${i}`, "DIMENSION", out, cat));
  (q.filters ?? []).forEach((f, i) => {
    const hit = resolveFieldRef(f.field, q.source, cat);
    if (!hit) out.push(issue("UNKNOWN_FIELD", `filters.${i}`, `"${f.field}" is not a field the catalogue knows.`));
    else if (hit.field.role !== "DIMENSION" || f.values.length === 0) out.push(issue("BAD_FILTER", `filters.${i}`, `Filter ${hit.field.label} by one or more of its values.`));
  });
  for (const [ref, agg] of Object.entries(q.aggregate ?? {})) {
    const def = aggregateDef(agg);
    if (!def) { out.push(issue("UNKNOWN_AGGREGATE", `aggregate.${ref}`, "Choose how to combine this figure.")); continue; }
    const hit = resolveFieldRef(ref, q.source, cat);
    if (!hit) continue;
    const refused = def.refuse(hit.field);
    if (refused && !(def.acceptsGroup && hit.field.role === "DIMENSION")) out.push(issue(refused.code as QueryProblemCode, `aggregate.${ref}`, refused.message));
  }
  // A distinct count cannot be added again (the same partner works in two districts): a total built from one is refused.
  for (const [i, c] of (q.calculated ?? []).entries()) {
    if ((c.op === "SUM" || c.op === "DIFFERENCE") && c.terms.some((t) => q.aggregate?.[t] !== undefined && aggregateDef(q.aggregate[t]!)?.summable === false)) {
      out.push(issue("COUNT_DISTINCT_SUMMED", `calculated.${i}`, "A count of different values, an average or a lowest/highest cannot be added to another figure."));
    }
  }
  const moneyAsked = q.measures.some((m) => resolveFieldRef(m, q.source, cat)?.field.money);
  const byCurrency = q.groupBy.some((g) => resolveFieldRef(g, q.source, cat)?.field.joinKey === "CURRENCY");
  if (moneyAsked && !byCurrency && !q.currency) out.push(issue("MONEY_NEEDS_CURRENCY", "currency", "Money is never added across currencies: choose one currency, or group by currency."));
  if (q.limit !== undefined && (!Number.isInteger(q.limit) || q.limit < 1 || q.limit > MAX_QUERY_ROWS)) out.push(issue("BAD_LIMIT", "limit", `Ask for between 1 and ${MAX_QUERY_ROWS} rows.`));
  for (const p of calculatedProblems(q.calculated ?? [], q.measures.map((m) => m), q.source, cat)) out.push(issue("CALCULATED_PROBLEM", p.path, p.message));
  return out;
}

/** Every source a query reads (its own and the ones its fields come from): the reader checks each source's permission. */
export function sourcesOf(q: VisualQuery, cat?: Catalogue): string[] {
  const refs = [...q.measures, ...q.groupBy, ...(q.filters ?? []).map((f) => f.field)];
  return [...new Set([q.source, ...refs.flatMap((r) => { const hit = resolveFieldRef(r, q.source, cat); return hit ? [hit.source] : []; })])];
}

/** True when an outside guest on a share link may ask this query: every source it reads is open to guests. */
export const isGuestSafe = (q: VisualQuery, cat?: Catalogue): boolean => sourcesOf(q, cat).every((s) => sourceOf(s, cat)?.guest === true);
