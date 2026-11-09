import type { ChartKind, ChartProblem, ChartProblemCode } from "./chart-spec-v2.js";
import { MAX_GAUGE_BANDS, STYLE_FIELDS, STYLE_FIELD_BY_PATH, STYLE_TONES, inScope, type StyleField } from "./chart-style-fields.js";
import type { ChartStyle } from "./chart-style-types.js";

/**
 * Chart style (Phase 47): the optional `style` block of a `ChartSpecV2`. It holds choices about how a chart looks, never data and never
 * a function, so it is stored, validated and exported like the rest of the spec. `applyChartStyle` (chart-style-apply.ts) patches the
 * option the builder drew and returns the very same object when there is nothing to apply, so a chart with no `style` is unchanged.
 * The honesty rules (bars start at zero, a gap is never 0, a rate is never stacked) stay in the builder and `validateChartSpec`.
 */

export * from "./chart-style-types.js";
export { STYLE_FIELDS, STYLE_FIELD_BY_PATH, STYLE_GROUPS, STYLE_SCOPE_KINDS, STYLE_RAMPS, STYLE_TONES, MAX_GAUGE_BANDS, inScope } from "./chart-style-fields.js";
export type { StyleField, StyleScope } from "./chart-style-fields.js";
export { applyChartStyle, applyScreenInteraction } from "./chart-style-apply.js";

/** One numeric option: its range and what the builder draws today (kept for the earlier callers of this table). */
export interface StyleNumberRule { path: string; min: number; max: number; integer?: boolean; default: number | null }
export const STYLE_NUMBER_RULES: ReadonlyArray<StyleNumberRule> = STYLE_FIELDS.flatMap((f) => (f.type === "number" ? [{ path: f.path, min: f.min, max: f.max, ...(f.integer ? { integer: true } : {}), default: f.default }] : []));

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const valueAt = (style: unknown, path: string): unknown => path.split(".").reduce<unknown>((o, k) => (isRecord(o) ? o[k] : undefined), style);
const CONTROL = /[\u0000-\u001f\u007f<>]/;

function fieldProblem(f: StyleField, v: unknown): string | null {
  switch (f.type) {
    case "number":
      return finite(v) && v >= f.min && v <= f.max && (!f.integer || Number.isInteger(v)) ? null : `This must be ${f.integer ? "a whole number" : "a number"} from ${f.min} to ${f.max}.`;
    case "choice": return typeof v === "string" && f.options.includes(v) ? null : "This choice is not known.";
    case "flag": return typeof v === "boolean" ? null : "This must be on or off.";
    case "text": return typeof v === "string" && v.length <= f.maxLength && !CONTROL.test(v) ? null : `Use at most ${f.maxLength} plain characters.`;
  }
}

/** Everything wrong with a style block; an empty list means it can be saved and drawn. `kind` lets the check say an option does not apply. */
export function validateChartStyle(style: unknown, kind: ChartKind): ChartProblem[] {
  const problems: ChartProblem[] = [];
  const add = (code: ChartProblemCode, path: string, message: string) => problems.push({ code, path: `style.${path}`, message });
  if (style === undefined) return problems;
  if (!isRecord(style)) return [{ code: "STYLE_INVALID", path: "style", message: "The chart's style is not valid." }];
  const notForKind = new Set<string>();
  for (const f of STYLE_FIELDS) {
    const v = valueAt(style, f.path);
    if (v === undefined) continue;
    const problem = fieldProblem(f, v);
    if (problem) add(f.type === "number" ? "STYLE_RANGE" : "STYLE_UNKNOWN", f.path, problem);
    else if (!inScope(f.scope, kind)) notForKind.add(f.path.split(".")[0]!);
  }
  for (const group of notForKind) add("STYLE_NOT_FOR_KIND", group, `${group} settings do not apply to this chart type.`);
  // A group or field the table does not know is refused rather than ignored.
  for (const [group, body] of Object.entries(style)) {
    if (!isRecord(body)) { add("STYLE_INVALID", group, "This part of the style is not valid."); continue; }
    for (const key of Object.keys(body)) if (!STYLE_FIELD_BY_PATH.has(`${group}.${key}`) && !(group === "gauge" && key === "bands")) add("STYLE_UNKNOWN", `${group}.${key}`, "This setting is not known.");
  }
  const s = style as ChartStyle;
  if (finite(s.pie?.innerRadius) && finite(s.pie?.outerRadius) && s.pie.innerRadius >= s.pie.outerRadius) add("STYLE_RANGE", "pie.innerRadius", "The inner radius must be smaller than the outer radius.");
  if (s.pie?.rose !== undefined && s.pie.rose !== "NONE" && (kind !== "PIE" && kind !== "DONUT" && kind !== "ROSE")) add("STYLE_NOT_FOR_KIND", "pie", "Rose settings do not apply to this chart type.");
  if (s.gauge?.bands !== undefined) {
    const bands = s.gauge.bands;
    if (!Array.isArray(bands) || bands.length > MAX_GAUGE_BANDS) add("STYLE_RANGE", "gauge.bands", `A dial has at most ${MAX_GAUGE_BANDS} colour bands.`);
    else {
      let last = 0;
      bands.forEach((b, i) => {
        if (!isRecord(b) || !finite(b.upTo) || b.upTo <= last || b.upTo > 100 || !STYLE_TONES.includes(b.tone as never)) add("STYLE_RANGE", `gauge.bands.${i}`, "Each band ends higher than the one before (up to 100) and has a colour.");
        else last = b.upTo;
      });
    }
    if (!inScope("GAUGE", kind)) add("STYLE_NOT_FOR_KIND", "gauge", "Gauge settings do not apply to this chart type.");
  }
  if (s.heat?.steps !== undefined && s.heat.steps !== 0 && s.heat.steps < 3) add("STYLE_RANGE", "heat.steps", "Use 0 for a smooth scale, or 3 to 9 steps.");
  return problems;
}
