import type { PlaceRegistry } from "../places/place.js";
import { resolvePlace } from "../places/place.js";
import { columnKind } from "./column-kinds.js";
import type { ColumnDef, DatasetRowValues } from "./model.js";
import { semanticOf } from "./semantics.js";
import type { TypedRow } from "./typed-rows.js";

export type PlaceMatch = { status: "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED"; placeId?: string | undefined; placeName?: string | undefined; via?: string | undefined };

/**
 * Every distinct place value of a dataset, resolved against the places list once (§1.2): by code, then alias, then a unique name, with
 * the project's country narrowing. Never guessed: an unknown or ambiguous value is listed apart and its rows keep no place.
 */
export function resolvePlaceValues(values: Iterable<string>, registry: PlaceRegistry, country?: string): Map<string, PlaceMatch> {
  const out = new Map<string, PlaceMatch>();
  for (const raw of values) {
    const key = raw.trim().toLowerCase();
    if (!key || out.has(key)) continue;
    const byCode = registry.all().find((p) => p.code && p.code.toLowerCase() === key);
    if (byCode) { out.set(key, { status: "RESOLVED", placeId: byCode.id, placeName: byCode.name, via: "CODE" }); continue; }
    const r = resolvePlace(raw, registry, country ? { country } : {});
    out.set(key, r.status === "RESOLVED" ? { status: "RESOLVED", placeId: r.place.id, placeName: r.place.name, via: r.via } : { status: r.status });
  }
  return out;
}

/** The place column a row's place is taken from: the deepest one when several are present (district before province). */
export function placeColumnOrder(columns: readonly ColumnDef[], rank: (c: ColumnDef) => number = () => 0): ColumnDef[] {
  return columns.filter((c) => semanticOf(c.semantic)?.resolver === "PLACE").sort((a, b) => rank(b) - rank(a));
}

/**
 * The stored rows: typed values plus the resolved place (the first place column whose value resolved, deepest first) and the period
 * key (the period column's value as read: YYYY-MM, YYYY-Www or YYYY-MM-DD). Row numbers are kept as in the person's sheet.
 */
export function toStoredRows(rows: readonly TypedRow[], columns: readonly ColumnDef[], places: ReadonlyMap<string, PlaceMatch>, placeOrder?: readonly ColumnDef[]): DatasetRowValues[] {
  const placeCols = placeOrder ?? placeColumnOrder(columns);
  const period = columns.find((c) => semanticOf(c.semantic)?.resolver === "PERIOD" && columnKind(c.kind)?.role === "GROUP");
  return rows.map((r) => {
    let placeId: string | undefined;
    for (const c of placeCols) {
      const v = r.values[c.key];
      const m = typeof v === "string" ? places.get(v.trim().toLowerCase()) : undefined;
      if (m?.placeId) { placeId = m.placeId; break; }
    }
    const p = period ? r.values[period.key] : null;
    return { rowNo: r.fileRow, values: r.values, ...(placeId ? { placeId } : {}), ...(typeof p === "string" ? { periodKey: p } : {}) };
  });
}
