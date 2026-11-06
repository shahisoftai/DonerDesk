/**
 * Design tokens for data surfaces (Phase 34.0): tiles, charts, status signals. One table; `globals.css` carries the same values as
 * CSS variables and a test fails if the two drift or a pair stops meeting its contrast minimum (WCAG 2.1 AA: 4.5:1 for text,
 * 3:1 for marks and borders that carry meaning). Pure: no React, no DOM.
 */

export type ThemeMode = "light" | "dark";

export interface TokenValue { light: string; dark: string }

/** Every token a data surface may use. The CSS variable is `--<name>`. */
export const TOKENS = {
  "tile-bg": { light: "#ffffff", dark: "#12231f" },
  "tile-border": { light: "#d8e0db", dark: "#2a3a35" },
  "tile-header-bg": { light: "#f4f7f5", dark: "#0f1d1a" },
  "tile-title": { light: "#0e1a16", dark: "#f1f5f9" },
  "tile-meta": { light: "#4f5f58", dark: "#a3b5ad" },
  // The one accent of the data surfaces: code badges and the focus of a tile. Brand saffron, deepened for white text on light.
  "badge-bg": { light: "#8a5610", dark: "#f2b544" },
  "badge-text": { light: "#ffffff", dark: "#0b1614" },
  // Status signals: used as text, icon and mark colour, never as the only signal (a word or an icon always goes with it).
  "signal-good": { light: "#15803d", dark: "#4ade80" },
  "signal-warn": { light: "#b45309", dark: "#fbbf24" },
  "signal-bad": { light: "#b91c1c", dark: "#f87171" },
  "signal-none": { light: "#5b6c64", dark: "#9fb1a9" },
  // Chart series, in order. Colour-blind distinguishable, each at least 3:1 against the tile.
  "viz-1": { light: "#0072B2", dark: "#56B4E9" },
  "viz-2": { light: "#C25400", dark: "#F28E2B" },
  "viz-3": { light: "#00855F", dark: "#3DCCA0" },
  "viz-4": { light: "#A8467F", dark: "#E58FC0" },
  "viz-5": { light: "#9A6A00", dark: "#F2C94C" },
  "viz-6": { light: "#2B7FB8", dark: "#8FC1EA" },
  "viz-7": { light: "#6A4C93", dark: "#B39DDB" },
  "viz-8": { light: "#4D4D4D", dark: "#C9D1CE" },
} as const satisfies Record<string, TokenValue>;

export type TokenName = keyof typeof TOKENS;
export const TOKEN_NAMES = Object.keys(TOKENS) as TokenName[];
export const VIZ_TOKENS: readonly TokenName[] = ["viz-1", "viz-2", "viz-3", "viz-4", "viz-5", "viz-6", "viz-7", "viz-8"];

/** The pages' own text colours (already in `globals.css`), checked here so the muted text is never below the minimum. */
export const PAGE_TOKENS = {
  background: { light: "#f1f4f1", dark: "#0b1614" },
  text: { light: "#0e1a16", dark: "#f1f5f9" },
  "text-secondary": { light: "#3d4f48", dark: "#a3b5ad" },
  "text-muted": { light: "#586a62", dark: "#7d918a" },
} as const satisfies Record<string, TokenValue>;

export interface ContrastPair { fg: string; bg: string; min: number; why: string }

const color = (name: string, mode: ThemeMode): string => {
  const t = (TOKENS as Record<string, TokenValue>)[name] ?? (PAGE_TOKENS as Record<string, TokenValue>)[name];
  if (!t) throw new Error(`Unknown token ${name}`);
  return t[mode];
};
export const tokenColor = color;

/** Every foreground/background pair that must meet its minimum, in both modes. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { fg: "tile-title", bg: "tile-bg", min: 4.5, why: "tile title" },
  { fg: "tile-meta", bg: "tile-bg", min: 4.5, why: "tile subtitle and as-of line" },
  { fg: "tile-meta", bg: "tile-header-bg", min: 4.5, why: "tile header text" },
  { fg: "tile-title", bg: "tile-header-bg", min: 4.5, why: "tile header title" },
  { fg: "badge-text", bg: "badge-bg", min: 4.5, why: "code badge" },
  { fg: "signal-good", bg: "tile-bg", min: 4.5, why: "status text: good" },
  { fg: "signal-warn", bg: "tile-bg", min: 4.5, why: "status text: warning" },
  { fg: "signal-bad", bg: "tile-bg", min: 4.5, why: "status text: bad" },
  { fg: "signal-none", bg: "tile-bg", min: 4.5, why: "status text: not measured" },
  ...VIZ_TOKENS.map((v): ContrastPair => ({ fg: v, bg: "tile-bg", min: 3, why: "chart series" })),
  { fg: "tile-border", bg: "tile-bg", min: 1.15, why: "tile edge is visible, not a barrier to reading" },
  { fg: "text", bg: "background", min: 4.5, why: "page text" },
  { fg: "text-secondary", bg: "background", min: 4.5, why: "secondary page text" },
  { fg: "text-muted", bg: "background", min: 4.5, why: "muted page text" },
];

const channel = (hex: string, i: number): number => {
  const v = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string): number => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);

/** WCAG contrast ratio of two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The pairs that fall short, in either mode; an empty list means the tokens pass. */
export function contrastFailures(): Array<{ pair: ContrastPair; mode: ThemeMode; ratio: number }> {
  const out: Array<{ pair: ContrastPair; mode: ThemeMode; ratio: number }> = [];
  for (const pair of CONTRAST_PAIRS) {
    for (const mode of ["light", "dark"] as const) {
      const ratio = contrastRatio(color(pair.fg, mode), color(pair.bg, mode));
      if (ratio < pair.min) out.push({ pair, mode, ratio });
    }
  }
  return out;
}

/** The series colour for the n-th series (wraps after eight; a chart with more series than colours should group the rest). */
export function vizColor(index: number, mode: ThemeMode): string {
  return color(VIZ_TOKENS[((index % VIZ_TOKENS.length) + VIZ_TOKENS.length) % VIZ_TOKENS.length]!, mode);
}
