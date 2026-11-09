import { evaluateCalculated } from "./calculated.js";
import { resolveFieldRef, sourceOf } from "./catalogue.js";
import type { Aggregate, VisualQuery } from "./query.js";
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

function modeOf(q: VisualQuery, ref: string, additive: boolean | undefined): Aggregate {
  return q.aggregate?.[ref] ?? (additive ? "SUM" : "VALUE");
}

function combine(values: Array<number | null>, mode: Aggregate): { value: number | null; mixed: boolean; partial: boolean } {
  const present = values.filter((v): v is number => v !== null);
  const partial = present.length > 0 && present.length < values.length;
  if (present.length === 0) return { value: null, mixed: false, partial: false };
  if (mode === "SUM") return { value: Math.round(present.reduce((a, b) => a + b, 0) * 1e6) / 1e6, mixed: false, partial };
  if (mode === "LATEST") return { value: present[present.length - 1]!, mixed: false, partial: false };
  // VALUE: shown only when the rows agree; two different figures are never averaged into a third.
  const distinct = new Set(present);
  return distinct.size === 1 ? { value: present[0]!, mixed: false, partial: false } : { value: null, mixed: true, partial: false };
}

/** Rows of a source reduced to one per value of a key field: measures combined by their own rule, never added when they cannot be. */
export function reduceByKey(source: string, keyField: string, rows: ReadonlyArray<VisualRow>): VisualRow[] {
  const def = sourceOf(source);
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
      if (f.role === "MEASURE") values[f.id] = combine(members.map((m) => num(m.values[f.id])), f.additive ? "SUM" : "VALUE").value;
      else { const only = new Set(members.map((m) => m.values[f.id])); values[f.id] = only.size === 1 ? [...only][0] ?? null : null; }
    }
    return { values, verified: members.every((m) => m.verified !== false) };
  });
}

export function shapeTable(rows: ReadonlyArray<VisualRow>, q: VisualQuery, joined: ReadonlyArray<JoinedInput> = []): VisualTable {
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
    const hit = resolveFieldRef(ref, q.source);
    return hit ? { id: ref, ref, label: hit.field.label, role, type: hit.field.type, ...(hit.field.unit ? { unit: hit.field.unit } : {}) } : undefined;
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
      const field = resolveFieldRef(m, q.source)?.field;
      const c = combine(members.map((r) => num(r.values[m])), modeOf(q, m, field?.additive));
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
