/**
 * Small charts on places (Phase 53.5). A marker compares the figures of two to four indicators at one place. Only what was recorded is
 * drawn: figures are read from the loaded results rows (never invented); a place that lacks any of them gets no marker and is counted.
 * Rules are a table (`MARKER_RULES`): a rule returns a refusal sentence code or null. A rate is never a pie; indicators with different
 * units never share one scale (the marker is refused, not drawn on two axes). Pure.
 */
export type MarkerKind = "NONE" | "BAR" | "PIE";
export const MARKER_LIMIT = 60;
export const MAX_MARKER_INDICATORS = 4;

export interface MarkerIndicator { id: string; code: string; name: string; unit: string | null; isRate: boolean; additive: boolean; rows: ReadonlyArray<{ placeId: string; name: string; value: string | null }> }
export type MarkerRefusal = "TOO_FEW" | "TOO_MANY" | "UNITS_DIFFER" | "RATE_IN_PIE" | "PIE_NOT_ADDITIVE" | "TOO_MANY_PLACES";
type Rule = (kind: Exclude<MarkerKind, "NONE">, inds: readonly MarkerIndicator[], placeCount: number) => MarkerRefusal | null;

export const MARKER_RULES: readonly Rule[] = [
  (_k, i) => (i.length < 2 ? "TOO_FEW" : null),
  (_k, i) => (i.length > MAX_MARKER_INDICATORS ? "TOO_MANY" : null),
  (_k, i) => (new Set(i.map((x) => x.unit ?? "")).size > 1 ? "UNITS_DIFFER" : null),
  (k, i) => (k === "PIE" && i.some((x) => x.isRate) ? "RATE_IN_PIE" : null),
  (k, i) => (k === "PIE" && i.some((x) => !x.additive) ? "PIE_NOT_ADDITIVE" : null),
  (_k, _i, n) => (n > MARKER_LIMIT ? "TOO_MANY_PLACES" : null),
];

export interface PlaceMarker { placeId: string; name: string; parts: ReadonlyArray<{ indicatorId: string; code: string; value: number }>; total: number }
export type MarkerResult = { ok: true; markers: PlaceMarker[]; withoutFull: number } | { ok: false; refusal: MarkerRefusal };

const num = (v: string | null): number | null => {
  if (v === null) return null;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function placeMarkers(kind: MarkerKind, inds: readonly MarkerIndicator[]): MarkerResult | null {
  if (kind === "NONE") return null;
  const names = new Map<string, string>();
  for (const i of inds) for (const r of i.rows) names.set(r.placeId, r.name);
  for (const rule of MARKER_RULES) { const out = rule(kind, inds, names.size); if (out) return { ok: false, refusal: out }; }
  const markers: PlaceMarker[] = [];
  let withoutFull = 0;
  for (const [placeId, name] of names) {
    const parts = inds.map((i) => ({ indicatorId: i.id, code: i.code, value: num(i.rows.find((r) => r.placeId === placeId)?.value ?? null) }));
    // Every figure must be recorded: a gap is never drawn as 0.
    if (parts.some((p) => p.value === null)) { withoutFull += 1; continue; }
    const full = parts as Array<{ indicatorId: string; code: string; value: number }>;
    if (kind === "PIE" && full.some((p) => p.value < 0)) { withoutFull += 1; continue; }
    markers.push({ placeId, name, parts: full, total: full.reduce((a, p) => a + p.value, 0) });
  }
  return { ok: true, markers, withoutFull };
}
