/**
 * A theme as a file (Phase 50.5, Power BI's "export / import theme"): an organisation keeps its look in one JSON file and loads it
 * into any canvas. A file is checked before anything uses it: unknown keys are refused (never silently ignored), colours must be
 * #rrggbb, a font must be one the product bundles (a file is drawn with bundled fonts only), and the built theme must pass the same
 * contrast check as every other theme. The file holds the spec, never the derived colours, so a theme built from it meets every rule.
 */
import { buildTheme, themeContrastProblems, THEME_TONES, NEUTRALS, type ThemeSpec } from "./build-theme.js";
import { fontById } from "./fonts.js";
import { HEX } from "./colour.js";

export const THEME_FILE_VERSION = 1;
const KEYS = new Set(["version", "id", "label", "description", "accent", "accent2", "neutral", "tone", "font", "radius", "headingCase", "semantic"]);
const SEMANTIC_KEYS = new Set(["good", "bad", "neutral"]);

export function exportThemeSpec(spec: ThemeSpec): string {
  const clean = Object.fromEntries(Object.entries(spec).filter(([, v]) => v !== undefined));
  return JSON.stringify({ version: THEME_FILE_VERSION, ...clean }, null, 2);
}

export type ThemeImport = { ok: true; spec: ThemeSpec } | { ok: false; problems: string[] };

export function importThemeSpec(text: string): ThemeImport {
  if (text.length > 20_000) return { ok: false, problems: ["A theme file is at most 20 KB."] };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, problems: ["This is not a theme file (it is not JSON)."] }; }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, problems: ["This is not a theme file."] };
  const o = raw as Record<string, unknown>;
  const p: string[] = [];
  for (const k of Object.keys(o)) if (!KEYS.has(k)) p.push(`"${k}" is not a theme setting.`);
  if (o["version"] !== undefined && o["version"] !== THEME_FILE_VERSION) p.push("This theme file is from a version the product does not read.");
  const str = (k: string, max: number, required = false): string | undefined => {
    const v = o[k];
    if (v === undefined) { if (required) p.push(`A theme needs "${k}".`); return undefined; }
    if (typeof v !== "string" || !v.trim() || v.length > max) { p.push(`"${k}" is text of 1 to ${max} characters.`); return undefined; }
    return v.trim();
  };
  const id = str("id", 40, true), label = str("label", 60, true);
  const description = typeof o["description"] === "string" && o["description"].length <= 200 ? o["description"].trim() : (o["description"] === undefined ? "" : (p.push("\"description\" is text of at most 200 characters."), ""));
  const colour = (k: string, v: unknown, required = false): string | undefined => {
    if (v === undefined) { if (required) p.push(`A theme needs "${k}".`); return undefined; }
    if (typeof v !== "string" || !HEX.test(v)) { p.push(`"${k}" is a colour written #rrggbb.`); return undefined; }
    return v.toLowerCase();
  };
  const accent = colour("accent", o["accent"], true), accent2 = colour("accent2", o["accent2"]);
  if (id && !/^[A-Za-z0-9_-]+$/.test(id)) p.push("A theme id uses letters, digits, - and _ only.");
  const neutral = o["neutral"], tone = o["tone"], font = o["font"], radius = o["radius"], headingCase = o["headingCase"];
  if (neutral !== undefined && !(NEUTRALS as readonly unknown[]).includes(neutral)) p.push(`"neutral" is one of ${NEUTRALS.join(", ")}.`);
  if (tone !== undefined && !(THEME_TONES as readonly unknown[]).includes(tone)) p.push(`"tone" is one of ${THEME_TONES.join(", ")}.`);
  if (font !== undefined && (typeof font !== "string" || !fontById(font)?.bundled)) p.push("That font is not one the product bundles, so a file could not be drawn with it.");
  if (radius !== undefined && (typeof radius !== "number" || !Number.isInteger(radius) || radius < 0 || radius > 24)) p.push('"radius" is a whole number of px from 0 to 24.');
  if (headingCase !== undefined && headingCase !== "UPPER" && headingCase !== "SENTENCE") p.push('"headingCase" is UPPER or SENTENCE.');
  let semantic: ThemeSpec["semantic"];
  if (o["semantic"] !== undefined) {
    const s = o["semantic"];
    if (typeof s !== "object" || s === null || Array.isArray(s)) p.push('"semantic" lists good, bad and neutral colours.');
    else {
      for (const k of Object.keys(s)) if (!SEMANTIC_KEYS.has(k)) p.push(`"semantic.${k}" is not a theme setting.`);
      const r = s as Record<string, unknown>;
      semantic = { good: colour("semantic.good", r["good"]), bad: colour("semantic.bad", r["bad"]), neutral: colour("semantic.neutral", r["neutral"]) };
    }
  }
  if (p.length || !id || !label || !accent) return { ok: false, problems: p.length ? p : ["A theme needs an id, a label and an accent colour."] };
  const spec: ThemeSpec = { id, label, description, accent, ...(accent2 ? { accent2 } : {}), ...(neutral ? { neutral: neutral as ThemeSpec["neutral"] } : {}), ...(tone ? { tone: tone as ThemeSpec["tone"] } : {}), ...(font ? { font: font as string } : {}), ...(radius !== undefined ? { radius: radius as number } : {}), ...(headingCase ? { headingCase: headingCase as ThemeSpec["headingCase"] } : {}), ...(semantic ? { semantic } : {}) };
  const contrast = themeContrastProblems(buildTheme(spec));
  if (contrast.length) return { ok: false, problems: contrast.map((c) => `${c.pair} reads at ${c.ratio}:1; it needs ${c.needed}:1.`) };
  return { ok: true, spec };
}
