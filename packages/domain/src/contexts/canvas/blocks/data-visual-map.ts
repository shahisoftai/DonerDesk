import type { CalculatedField } from "../../visual-data/calculated.js";
import type { VisualRow } from "../../visual-data/shape.js";
import { PLACE_ID_FIELD } from "../../datasets/to-source.js";

/**
 * A dataset on a real map (Phase 54): the dataset's figures as "results by place" for every admin level, in the shape the Maps explorer
 * already draws (boundaries, colours, legend, drilling from province to district). Pure. Rows carry the place matched at save time
 * (`_place_id`, the deepest place column that matched); a figure reaches a higher area through the place tree. Counts are added; a rate is
 * Σ part ÷ Σ whole over the area's rows, never an average; a column that cannot be added (a stock level, a recorded rate) is shown only for
 * the place that recorded it. Rows whose place matched nothing are listed apart, never placed at a guess.
 */
export interface MapPlace { id: string; name: string; adminLevel: number; parentId?: string | undefined; path: string; country?: string | undefined; code?: string | undefined; latitude?: number | undefined; longitude?: number | undefined; kind: "POINT" | "AREA" }

export interface MapFigure { id: string; label: string; unit?: string | undefined; additive: boolean; rate: boolean; parts?: { numerator: string; denominator: string; percent: boolean } | undefined }

interface RollupRow { placeId: string; name: string; path: string; adminLevel: number; value: string | null; verified: boolean; unverified: number; contributors: number; listedBelow: number; partly: boolean }
export interface MapLevelResults {
  level: number;
  levelsAvailable: number[];
  periods: Array<{ id: string; label: string }>;
  noPlaces: boolean;
  indicators: Array<{ id: string; code: string; name: string; unit: string | null; type: string; isRate: boolean; rollup: { level: number; additive: boolean; rows: RollupRow[]; unplaced: Array<{ location: string; value: string; reason: "NOT_IN_LIST" | "MORE_THAN_ONE_PLACE" | "ABOVE_LEVEL" }> } }>;
  withoutLocation: Array<{ id: string; code: string; name: string }>;
}
export interface DatasetMap { places: MapPlace[]; byLevel: Record<string, MapLevelResults>; firstLevel: number; unplacedRows: number }

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (n: number | null, rate: boolean): string | null => (n === null ? null : String(Math.round(n * (rate ? 10 : 100)) / (rate ? 10 : 100)));

/** The figures a map shows: the columns in the visual's VALUES/COLOUR well and its calculated rates. */
export function mapFigures(drawn: readonly string[], fields: ReadonlyArray<{ id: string; label: string; unit?: string | undefined; additive?: boolean | undefined; type: string }>, calculated: readonly CalculatedField[]): MapFigure[] {
  const out: MapFigure[] = [];
  for (const id of drawn) {
    const calc = calculated.find((c) => c.id === id);
    if (calc) { if ((calc.op === "RATIO" || calc.op === "SHARE") && calc.terms.length === 2) out.push({ id, label: calc.label, additive: false, rate: Boolean(calc.percent), parts: { numerator: calc.terms[0]!, denominator: calc.terms[1]!, percent: Boolean(calc.percent) }, ...(calc.percent ? { unit: "%" } : {}) }); continue; }
    const f = fields.find((x) => x.id === id);
    if (f) out.push({ id, label: f.label, ...(f.unit ? { unit: f.unit } : {}), additive: f.additive === true, rate: f.type === "RATE" });
  }
  return out;
}

export function datasetMap(rows: readonly VisualRow[], places: readonly MapPlace[], figures: readonly MapFigure[], placeTextColumn?: string): DatasetMap {
  const byId = new Map(places.map((p) => [p.id, p]));
  const ancestorAt = (id: string, level: number): MapPlace | undefined => {
    let p = byId.get(id);
    for (let i = 0; p && i < 8; i += 1) { if (p.adminLevel === level) return p; if (p.adminLevel < level) return undefined; p = p.parentId ? byId.get(p.parentId) : undefined; }
    return undefined;
  };
  const placed = rows.filter((r) => typeof r.values[PLACE_ID_FIELD] === "string" && byId.has(r.values[PLACE_ID_FIELD] as string));
  const unplacedRows = rows.length - placed.length;
  const levels = [...new Set(placed.flatMap((r) => { const out: number[] = []; let p = byId.get(r.values[PLACE_ID_FIELD] as string); for (let i = 0; p && i < 8; i += 1) { out.push(p.adminLevel); p = p.parentId ? byId.get(p.parentId) : undefined; } return out; }))].filter((l) => l >= 1).sort((a, b) => a - b);
  const byLevel: Record<string, MapLevelResults> = {};
  for (const level of levels) {
    const groups = new Map<string, VisualRow[]>();
    const above: VisualRow[] = [];
    for (const r of placed) { const a = ancestorAt(r.values[PLACE_ID_FIELD] as string, level); if (a) groups.set(a.id, [...(groups.get(a.id) ?? []), r]); else above.push(r); }
    const indicators = figures.map((f) => {
      const rowsOut: RollupRow[] = [];
      for (const [placeId, members] of groups) {
        const p = byId.get(placeId)!;
        let value: number | null;
        if (f.parts) {
          const both = members.filter((m) => num(m.values[f.parts!.numerator]) !== null && num(m.values[f.parts!.denominator]) !== null);
          const den = both.reduce((a, m) => a + num(m.values[f.parts!.denominator])!, 0);
          value = both.length && den !== 0 ? (both.reduce((a, m) => a + num(m.values[f.parts!.numerator])!, 0) / den) * (f.parts.percent ? 100 : 1) : null;
        } else if (f.additive) {
          const xs = members.map((m) => num(m.values[f.id])).filter((x): x is number => x !== null);
          value = xs.length ? xs.reduce((a, b) => a + b, 0) : null;
        } else {
          // Not addable: shown only where one place recorded one figure.
          const own = members.filter((m) => m.values[PLACE_ID_FIELD] === placeId).map((m) => num(m.values[f.id])).filter((x): x is number => x !== null);
          value = own.length === 1 && members.length === 1 ? own[0]! : null;
        }
        const below = new Set(members.map((m) => m.values[PLACE_ID_FIELD])).size;
        rowsOut.push({ placeId, name: p.name, path: p.path, adminLevel: p.adminLevel, value: text(value, f.rate || Boolean(f.parts)), verified: true, unverified: 0, contributors: members.length, listedBelow: below, partly: false });
      }
      const unplaced = above.slice(0, 50).map((r) => ({ location: String((placeTextColumn ? r.values[placeTextColumn] : undefined) ?? byId.get(r.values[PLACE_ID_FIELD] as string)?.name ?? ""), value: text(num(r.values[f.id]), f.rate) ?? "", reason: "ABOVE_LEVEL" as const }));
      return { id: f.id, code: "", name: f.label, unit: f.unit ?? null, type: f.rate || f.parts ? "PERCENTAGE" : "NUMBER", isRate: f.rate || Boolean(f.parts), rollup: { level, additive: f.additive, rows: rowsOut.sort((a, b) => a.name.localeCompare(b.name)), unplaced } };
    });
    byLevel[String(level)] = { level, levelsAvailable: levels, periods: [], noPlaces: groups.size === 0, indicators, withoutLocation: [] };
  }
  // The map opens on the deepest level most rows reached (districts when a table is by district).
  const counts = levels.map((l) => ({ l, n: Object.values(byLevel[String(l)]!.indicators[0]?.rollup.rows ?? []).length }));
  const filled = counts.filter((c) => c.n > 1).map((c) => c.l);
  const firstLevel = filled[filled.length - 1] ?? levels[levels.length - 1] ?? 1;
  return { places: places.filter((p) => levels.includes(p.adminLevel) || p.adminLevel === 0), byLevel, firstLevel, unplacedRows };
}
