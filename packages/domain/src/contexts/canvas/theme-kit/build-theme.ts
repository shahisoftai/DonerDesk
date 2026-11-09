/**
 * Building a theme from a few choices (Phase 48.2 / 48.13). A `ThemeSpec` names a mood, an accent colour and a font; `buildTheme` works
 * out every colour role from them and fits each text colour to its background, so a theme built here can never fail the contrast check
 * the brand kit and the editor run. Three variants come from the same spec: light, dark and print.
 */
import { contrastRatio, type InfographicTheme } from "../../infographics/theme.js";
import { MIN_SERIES_DISTANCE, categoricalPalette, distinguishable } from "./palette.js";
import { darken, ensureContrast, fromHsl, lighten, mix, toHsl } from "./colour.js";
import { stackFor } from "./fonts.js";

export const THEME_TONES = ["LIGHT", "DARK", "PRINT", "HIGH_CONTRAST"] as const;
export type ThemeTone = (typeof THEME_TONES)[number];
export const NEUTRALS = ["COOL", "WARM", "NEUTRAL"] as const;
export type Neutral = (typeof NEUTRALS)[number];

export interface ThemeSpec {
  id: string;
  label: string;
  description: string;
  /** The brand colour: headings, rules, primary bars. */
  accent: string;
  /** The second data colour; defaults to the accent turned a third of the way round the wheel. */
  accent2?: string | undefined;
  neutral?: Neutral | undefined;
  tone?: ThemeTone | undefined;
  /** A font id from the library. */
  font?: string | undefined;
  radius?: number | undefined;
  headingCase?: InfographicTheme["headingCase"] | undefined;
}

/** The colour-blind-safe set the older themes use; every colour is fitted to the card before it is offered. */
const OKABE_ITO = ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#f0e442", "#000000"] as const;

const NEUTRAL_HUE: Record<Neutral, number | null> = { COOL: 215, WARM: 35, NEUTRAL: null };

/** A grey with a trace of the neutral's hue, `l` lightness 0..1. */
function grey(neutral: Neutral, l: number, saturation = 0.12): string {
  const hue = NEUTRAL_HUE[neutral];
  return hue === null ? fromHsl(0, 0, l) : fromHsl(hue, saturation, l);
}

export function buildTheme(spec: ThemeSpec): InfographicTheme {
  const tone = spec.tone ?? "LIGHT";
  const neutral = spec.neutral ?? "COOL";
  const dark = tone === "DARK";
  const hc = tone === "HIGH_CONTRAST";
  const print = tone === "PRINT";
  const page = dark ? grey(neutral, 0.09) : hc ? "#000000" : "#ffffff";
  const card = dark ? grey(neutral, 0.13) : hc ? "#000000" : "#ffffff";
  const surface = dark ? grey(neutral, 0.17) : hc ? "#0a0a0a" : print ? "#f5f5f5" : grey(neutral, 0.97, 0.2);
  const line = dark ? grey(neutral, 0.26) : hc ? "#ffffff" : grey(neutral, 0.9, 0.1);
  const base = hc ? "#ffd400" : print ? darken(spec.accent, 0.25) : spec.accent;
  const accent = ensureContrast(base, card, hc ? 7 : 4.5);
  const ink = dark || hc ? "#f8fafc" : grey(neutral, 0.1, 0.25);
  const body = ensureContrast(dark || hc ? grey(neutral, 0.85) : grey(neutral, 0.27, 0.15), card, 7);
  const muted = ensureContrast(dark || hc ? grey(neutral, 0.7) : grey(neutral, 0.42, 0.12), card, 4.5);
  const subtle = ensureContrast(dark || hc ? grey(neutral, 0.6) : grey(neutral, 0.62, 0.1), card, 3);
  const { h } = toHsl(spec.accent);
  const accent2 = ensureContrast(spec.accent2 ?? fromHsl(h + 120, 0.6, dark ? 0.62 : 0.45), card, 3);
  const warn = ensureContrast(dark ? "#fbbf24" : "#92400e", card, 4.5);
  const water = dark ? mix(page, accent, 0.12) : lighten(mix("#eaf2fb", accent, 0.08), 0.2);
  const fit = (c: string): string => ensureContrast(c, card, 3);
  const candidates = [accent, accent2, ...categoricalPalette(spec.accent, 12, card), ...OKABE_ITO.map(fit)];
  // Keep colours that stay apart for every kind of colour-blindness; ask for a wide gap first and relax it until there are enough.
  let palette: string[] = [];
  for (const gap of [MIN_SERIES_DISTANCE, 15, 12]) { palette = distinguishable(candidates, gap).slice(0, 10); if (palette.length >= 6) break; }
  const signal = (c: string) => ensureContrast(c, card, 3);
  return {
    id: spec.id, label: spec.label, description: spec.description, font: stackFor(spec.font),
    page, card, cardStroke: line, surface, ink, body, muted, subtle, line, accent,
    accentSoft: dark ? mix(card, accent, 0.22) : lighten(accent, 0.88), accent2, warn,
    mapWater: water, mapWaterStroke: dark ? lighten(water, 0.08) : darken(water, 0.05), mapLabel: ensureContrast(body, water, 4.5), mapNote: ensureContrast(muted, water, 4.5),
    signals: { ON_TIME: signal("#16a34a"), LATE: signal("#dc2626"), DONE: signal(dark ? "#60a5fa" : "#2563eb"), CANCELLED: signal("#94a3b8") },
    palette,
    radius: spec.radius ?? (print ? 4 : 10), headingCase: spec.headingCase ?? "SENTENCE",
  };
}

/** The same theme in another tone (light, dark, print, high contrast); the spec is rebuilt, so every contrast rule is met again. */
export const withTone = (spec: ThemeSpec, tone: ThemeTone): InfographicTheme => buildTheme({ ...spec, tone, id: tone === "LIGHT" ? spec.id : `${spec.id}:${tone.toLowerCase()}` });

export interface ThemeProblem { pair: string; ratio: number; needed: number }
/** Every text pair of a theme against its background; the contrast the Design check reads. */
export function themeContrastProblems(t: InfographicTheme): ThemeProblem[] {
  const pairs: Array<[string, string, string, number]> = [
    ["ink on page", t.ink, t.page, 4.5], ["body on page", t.body, t.page, 4.5], ["body on card", t.body, t.card, 4.5], ["muted on card", t.muted, t.card, 4.5],
    ["accent on card", t.accent, t.card, 3], ["warn on card", t.warn, t.card, 4.5], ["map label on water", t.mapLabel, t.mapWater, 4.5],
    ...t.palette.map((c, i): [string, string, string, number] => [`series ${i + 1} on card`, c, t.card, 3]),
  ];
  return pairs.map(([pair, fg, bg, needed]) => ({ pair, ratio: Math.round(contrastRatio(fg, bg) * 100) / 100, needed })).filter((p) => p.ratio < p.needed);
}
