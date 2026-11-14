import { evaluateCalculated } from "./calculated.js";
import { resolveFieldRef, sourceOf, type Catalogue } from "./catalogue.js";
import { aggregateDef, defaultAggregate, type Combined } from "./aggregates.js";
import type { VisualQuery } from "./query.js";
import type { FieldRole, FieldType } from "./types.js";

/**
 * Turning rows into the table a block draws (Phase 48.17). Pure: the same rows and the same question always give the same table.
 * The rules here are the product's honesty rules for any visual: a figure with nothing recorded is null (never 0), a rate is
 * shown as recorded and never added, money stays inside one currency, and a value that is not verified is left out, or counted, but
 * never silently mixed in.
 */
export type Cell = string | number | null;

export interface VisualRow {
  values: Record<string, Cell>;
  /** false = a draft, handed-in or returned value; absent = the source has no notion of verification. */
  verified?: boolean | undefined;
}

export interface ColumnInfo { id: string; ref: string; label: string; role: FieldRole | "CALCULATED"; type: FieldType; unit?: string | undefined }

export interface VisualTable {
  columns: ColumnInfo[];
  rows: Array<Record<string, Cell>>;
  /** Plain sentences the block shows under the picture and the file carries. */
  notes: string[];
}

/** Rows of a joined source, already reduced to one row per join key by the caller (`reduceByKey`). */
export interface JoinedInput { source: string; keyField: string; mainKeyField: string; rows: ReadonlyArray<VisualRow> }

const num = (c: Cell | undefined): number | null => (typeof c === "number" && Number.isFinite(c) ? c : null);

/** Cells combined by an aggregate row (`aggregates.ts`); an unknown key falls back to the field's default. */
function combineBy(key: string, cells: Cell[]): Combined {
  return (aggregateDef(key) ?? aggregateDef("VALUE")!).combine(cells);
}

/** Rows of a source reduced to one per value of a key field: measures combined by their own rule, never added when they cannot be. */
export function reduceByKey(source: string, keyField: string, rows: ReadonlyArray<VisualRow>, cat?: Catalogue): VisualRow[] {
  const def = sourceOf(source, cat);
  const groups = new Map<string, VisualRow[]>();
  for (const r of rows) {
    const k = r.values[keyField];
    if (k === null || k === undefined) continue;
    groups.set(String(k), [...(groups.get(String(k)) ?? []), r]);
  }
  return [...groups].map(([key, members]) => {
    const values: Record<string, Cell> = { [keyField]: key };
    for (const f of def?.fields ?? []) {
      if (f.id === keyField) continue;
      if (f.role === "MEASURE") values[f.id] = combineBy(f.additive ? "SUM" : "VALUE", members.map((m) => num(m.values[f.id]))).value;
      else { const only = new Set(members.map((m) => m.values[f.id])); values[f.id] = only.size === 1 ? [...only][0] ?? null : null; }
    }
    return { values, verified: members.every((m) => m.verified !== false) };
  });
}

export function shapeTable(rows: ReadonlyArray<VisualRow>, q: VisualQuery, joined: ReadonlyArray<JoinedInput> = [], cat?: Catalogue): VisualTable {
  const notes: string[] = [];
  let work = rows.map((r) => ({ values: { ...r.values }, verified: r.verified }));

  for (const j of joined) {
    const byKey = new Map(j.rows.map((r) => [String(r.values[j.keyField]), r]));
    work = work.map((r) => {
      const hit = byKey.get(String(r.values[j.mainKeyField]));
      const extra: Record<string, Cell> = {};
      for (const [k, v] of Object.entries(hit?.values ?? {})) extra[`${j.source}.${k}`] = v;
      return { values: { ...r.values, ...extra }, verified: r.verified };
    });
  }

  for (const f of q.filters ?? []) work = work.filter((r) => f.values.includes(String(r.values[f.field] ?? "")));
  if (q.currency) work = work.filter((r) => r.values["currency"] === undefined || r.values["currency"] === q.currency);

  const unverified = work.filter((r) => r.verified === false).length;
  if (!q.includeDraft && unverified > 0) {
    // The figure is withheld, not the row: the period still shows, as not measured, so a draft never looks like a missing period.
    work = work.map((r) => (r.verified === false ? { ...r, values: { ...r.values, ...Object.fromEntries(q.measures.map((m) => [m, null])) } } : r));
    notes.push(`${unverified} ${unverified === 1 ? "value is" : "values are"} not verified yet and ${unverified === 1 ? "was" : "were"} left out.`);
  } else if (q.includeDraft && unverified > 0) {
    notes.push(`${unverified} of ${work.length} ${work.length === 1 ? "value is" : "values are"} not verified yet.`);
  }

  const columns: ColumnInfo[] = [];
  const info = (ref: string, role: "MEASURE" | "DIMENSION"): ColumnInfo | undefined => {
    const hit = resolveFieldRef(ref, q.source, cat);
    if (!hit) return undefined;
    // A counted group field is a count, whatever it was (a district counted is a number of districts).
    const counted = role === "MEASURE" && aggregateDef(q.aggregate?.[ref] ?? "")?.acceptsGroup === true;
    const agg = aggregateDef(q.aggregate?.[ref] ?? "");
    const label = counted && hit.field.role === "DIMENSION" ? `${hit.field.label} (${agg!.label.toLowerCase()})` : hit.field.label;
    return { id: ref, ref, label, role, type: counted ? "COUNT" : hit.field.type, ...(hit.field.unit && !counted ? { unit: hit.field.unit } : {}) };
  };
  for (const g of q.groupBy) { const c = info(g, "DIMENSION"); if (c) columns.push(c); }
  for (const m of q.measures) { const c = info(m, "MEASURE"); if (c) columns.push(c); }

  const groups = new Map<string, typeof work>();
  for (const r of work) {
    const key = JSON.stringify(q.groupBy.map((g) => r.values[g] ?? null));
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  if (q.groupBy.length === 0 && groups.size === 0) groups.set("[]", []);

  let mixedNote = false, partialNote = false;
  const out: Array<Record<string, Cell>> = [];
  for (const members of groups.values()) {
    const row: Record<string, Cell> = {};
    for (const g of q.groupBy) row[g] = members[0]?.values[g] ?? null;
    for (const m of q.measures) {
      const field = resolveFieldRef(m, q.source, cat)?.field;
      const mode = q.aggregate?.[m] ?? defaultAggregate(field);
      const c = combineBy(mode, members.map((r) => (aggregateDef(mode)?.acceptsGroup ? r.values[m] ?? null : num(r.values[m]))));
      row[m] = c.value;
      mixedNote ||= c.mixed;
      partialNote ||= c.partial;
    }
    for (const calc of q.calculated ?? []) row[calc.id] = evaluateCalculated(calc, row as Record<string, number | null>);
    out.push(row);
  }
  for (const calc of q.calculated ?? []) columns.push({ id: calc.id, ref: calc.id, label: calc.label, role: "CALCULATED", type: calc.percent ? "RATE" : "COUNT" });
  if (mixedNote) notes.push("Some groups hold more than one different figure for a rate or a count that cannot be added; they are shown as not measured.");
  if (partialNote) notes.push("Some groups add up only the rows that have a figure; rows with nothing recorded are left out of the total, never counted as 0.");
  const limit = q.limit ?? out.length;
  if (out.length > limit) notes.push(`Showing the first ${limit} of ${out.length} rows.`);
  return { columns, rows: out.slice(0, limit), notes };
}
