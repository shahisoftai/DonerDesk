import { rankDrivers, type DriverResult } from "../../datasets/drivers.js";
import { PERIOD_KEY_FIELD } from "../../datasets/to-source.js";
import { defineBlock } from "../block-definition.js";
import { NOT_READ, type DatasetBlockData } from "../datasets/dataset-data.js";

/**
 * Which groups differ on a figure (Phase 54, §3.11, D4): rows are first combined per unit and period (a rate as Σ part ÷ Σ whole),
 * then `rankDrivers` compares each candidate's groups. Explainable only, with the group sizes shown; it says "a difference, not a cause".
 */
export interface DataDriversProps {
  source: string;
  /** The figure compared: one column, or a rate from two (numerator ÷ denominator). */
  outcome: { column?: string | undefined; numerator?: string | undefined; denominator?: string | undefined; percent?: boolean | undefined; label: string };
  /** The unit rows are combined by (a place or facility column). */
  unitColumn: string;
  candidates: string[];
  title?: string | undefined;
}
export interface DataDriversModel { outcome: string; results: DriverResult[] }

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export const dataDriversBlock = defineBlock<DataDriversProps, DataDriversModel, DatasetBlockData | undefined>({
  kind: "DATA_DRIVERS",
  family: "AI",
  labelKey: "canvas.block.DATA_DRIVERS",
  requiresSetup: true,
  reads: "DATASET",
  defaults: () => ({ source: "", outcome: { label: "" }, unitColumn: "", candidates: [] }),
  validate: (p) => {
    if (!p.source) return [{ message: "Choose the dataset." }];
    const o = p.outcome;
    if (!o.label.trim() || (!o.column && !(o.numerator && o.denominator))) return [{ message: "Choose the figure to compare: one column, or a rate from two." }];
    if (!p.unitColumn) return [{ message: "Choose what one row stands for (a place or a facility)." }];
    if (p.candidates.length === 0 || p.candidates.length > 8) return [{ message: "Choose between 1 and 8 things that might make a difference." }];
    return [];
  },
  slots: [],
  sizes: { min: { w: 4, h: 3 }, max: { w: 12, h: 8 }, default: { w: 6, h: 5 } },
  lint: [],
  resolve: (p, data) => {
    if (!data) return NOT_READ;
    const names = new Map(data.source.fields.map((f) => [f.id, f.label]));
    for (const c of p.candidates) if (!names.has(c)) return { state: "unavailable", reason: "A chosen column is not in this dataset." };
    const groups = new Map<string, Array<Record<string, unknown>>>();
    for (const r of data.rows) {
      const unit = r.values[p.unitColumn];
      if (unit === null || unit === undefined) continue;
      const k = `${String(unit)}\u0000${String(r.values[PERIOD_KEY_FIELD] ?? "")}`;
      groups.set(k, [...(groups.get(k) ?? []), r.values]);
    }
    const o = p.outcome;
    const rows = [...groups.values()].map((members) => {
      let outcome: number | null;
      if (o.column) { const xs = members.map((m) => num(m[o.column!])).filter((x): x is number => x !== null); outcome = xs.length ? xs.reduce((a, b) => a + b, 0) : null; }
      else {
        const both = members.filter((m) => num(m[o.numerator!]) !== null && num(m[o.denominator!]) !== null);
        const den = both.reduce((a, m) => a + num(m[o.denominator!])!, 0);
        outcome = both.length && den ? (both.reduce((a, m) => a + num(m[o.numerator!])!, 0) / den) * (o.percent ? 100 : 1) : null;
      }
      const attributes = Object.fromEntries(p.candidates.map((c) => { const vs = new Set(members.map((m) => (m[c] === null || m[c] === undefined ? null : String(m[c])))); return [c, vs.size === 1 ? [...vs][0] ?? null : null]; }));
      return { outcome, attributes };
    });
    if (rows.filter((r) => r.outcome !== null).length < 16) return { state: "empty", reason: "Too few places and periods with this figure to compare groups fairly (at least 16 are needed)." };
    const results = rankDrivers(rows, o.label, p.candidates.map((c) => ({ key: c, label: names.get(c)! })));
    return { state: "ready", model: { outcome: o.label, results }, notes: ["Each row is one place and period. Differences between groups are shown with their sizes; they are not causes."] };
  },
});
