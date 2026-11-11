/**
 * Conditional formatting (Phase 50.2): a value becomes a colour, an icon or a data bar by a rule. The rules are honest by
 * construction: a missing value is never coloured (it keeps the plain "Not reported" look), and the caller says whether the value
 * is a rate so a share-of-target rule is never applied to one (rules compare the value itself).
 */
import { HEX, mix } from "../theme-kit/colour.js";
import { COLOUR_ROLES, CONDITIONAL_ICONS, RULE_OPERATORS, type ColourChoice, type ConditionalBand, type ConditionalIcon, type ConditionalRule } from "./types.js";

export const MAX_RULES = 4;
export const MAX_BANDS = 8;

export type ConditionalEffect = { color?: ColourChoice | { hex: string }; icon?: ConditionalIcon; bar?: { share: number; color: ColourChoice }; target?: "background" | "text" };

export function bandMatches(band: ConditionalBand, v: number): boolean {
  switch (band.op) {
    case "GTE": return v >= band.value;
    case "GT": return v > band.value;
    case "LT": return v < band.value;
    case "LTE": return v <= band.value;
    case "EQ": return v === band.value;
    case "BETWEEN": return band.to !== undefined && v >= Math.min(band.value, band.to) && v <= Math.max(band.value, band.to);
  }
}

/** Colours mixed for a gradient need real colours: the caller resolves roles to hex through the theme. */
export type RoleResolver = (c: ColourChoice) => string;

/**
 * The effect of a rule list on one value. `range` is the smallest and largest value of the column or series the value sits in (a
 * gradient without fixed ends uses it). The first matching band wins; rules apply in order and later ones fill what earlier left unset.
 */
export function conditionalEffect(value: number | null, rules: readonly ConditionalRule[], range: { min: number; max: number } | null, resolve: RoleResolver): ConditionalEffect | null {
  if (value === null || !Number.isFinite(value)) return null;
  const out: ConditionalEffect = {};
  for (const rule of rules) {
    if (rule.kind === "RULES" && out.color === undefined) {
      const band = rule.bands.find((b) => bandMatches(b, value));
      if (band) { out.color = band.color; out.target = rule.target; }
    } else if (rule.kind === "ICONS" && out.icon === undefined) {
      const band = rule.bands.find((b) => bandMatches(b, value));
      if (band?.icon) out.icon = band.icon;
    } else if (rule.kind === "GRADIENT" && out.color === undefined) {
      const lo = rule.minValue ?? range?.min, hi = rule.maxValue ?? range?.max;
      if (lo === undefined || hi === undefined) continue;
      const t = hi === lo ? 1 : Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
      const a = resolve(rule.min), b = resolve(rule.max);
      const hex = rule.mid ? (t < 0.5 ? mix(a, resolve(rule.mid), t * 2) : mix(resolve(rule.mid), b, (t - 0.5) * 2)) : mix(a, b, t);
      out.color = { hex }; out.target = rule.target;
    } else if (rule.kind === "DATA_BARS" && out.bar === undefined && range) {
      // A bar starts at zero (never a cut axis); a negative value has no bar.
      const top = Math.max(range.max, 0);
      out.bar = { share: top <= 0 || value <= 0 ? 0 : Math.min(1, value / top), color: rule.color };
    }
  }
  return Object.keys(out).length === 0 ? null : out;
}

export function colourChoiceProblem(c: ColourChoice | undefined): string | null {
  if (c === undefined) return null;
  if ("role" in c) return (COLOUR_ROLES as readonly string[]).includes(c.role) ? null : "Choose one of the theme colours.";
  return HEX.test(c.hex) ? null : "A custom colour is written #rrggbb.";
}

export function conditionalProblems(rules: readonly ConditionalRule[], opts: { isRate: boolean }): string[] {
  const out: string[] = [];
  if (rules.length > MAX_RULES) out.push(`At most ${MAX_RULES} rules.`);
  for (const r of rules) {
    if (r.kind === "RULES" || r.kind === "ICONS") {
      if (r.bands.length === 0 || r.bands.length > MAX_BANDS) out.push(`A rule has 1 to ${MAX_BANDS} bands.`);
      for (const b of r.bands) {
        if (!RULE_OPERATORS.includes(b.op) || !Number.isFinite(b.value)) out.push("Each band compares with a number.");
        if (b.op === "BETWEEN" && (b.to === undefined || !Number.isFinite(b.to))) out.push("A 'between' band needs both ends.");
        if (r.kind === "ICONS" && (!b.icon || !CONDITIONAL_ICONS.includes(b.icon))) out.push("Each icon band needs an icon.");
        const c = colourChoiceProblem(b.color); if (c) out.push(c);
      }
    } else if (r.kind === "GRADIENT") {
      for (const c of [r.min, r.mid, r.max]) { const p = colourChoiceProblem(c); if (p) out.push(p); }
      if (r.minValue !== undefined && r.maxValue !== undefined && r.minValue >= r.maxValue) out.push("A gradient's low end is below its high end.");
    } else if (r.kind === "DATA_BARS") {
      const p = colourChoiceProblem(r.color); if (p) out.push(p);
      if (opts.isRate) out.push("A rate is not drawn as a bar of the column's largest value.");
    } else out.push("Unknown rule.");
  }
  return [...new Set(out)];
}
