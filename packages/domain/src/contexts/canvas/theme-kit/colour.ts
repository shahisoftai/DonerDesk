/**
 * Colour arithmetic for themes (Phase 48.2 / 48.13). Pure functions on `#rrggbb` strings: mixing, lightness changes, contrast
 * fixing and colour-blindness simulation. Contrast is WCAG's (the same function the brand kit uses); distinguishability between
 * palette colours is measured in CIELAB (ΔE 2000-lite) after simulating how a colour-blind reader sees them.
 */
import { contrastRatio } from "../../infographics/theme.js";

export type Rgb = readonly [number, number, number];
export const HEX = /^#[0-9a-f]{6}$/i;

export function parseHex(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp255 = (n: number): number => Math.min(255, Math.max(0, Math.round(n)));
export const toHex = ([r, g, b]: Rgb): string => `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("")}`;

/** `t` = 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a), y = parseHex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export const lighten = (hex: string, t: number): string => mix(hex, "#ffffff", t);
export const darken = (hex: string, t: number): string => mix(hex, "#000000", t);

export function toHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = parseHex(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

export function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, hh = (((h % 360) + 360) % 360) / 60, x = c * (1 - Math.abs((hh % 2) - 1)), m = l - c / 2;
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

/**
 * Moves a colour toward black or white (whichever direction can reach it) until it has `min`:1 against `against`; the hue is kept, and a
 * colour that already reads is returned unchanged. The same idea as the chart presets' `fitToSurface`.
 */
export function ensureContrast(colour: string, against: string, min: number): string {
  if (contrastRatio(colour, against) >= min) return colour;
  const towardWhite = contrastRatio("#ffffff", against) >= contrastRatio("#000000", against);
  const end = towardWhite ? "#ffffff" : "#000000";
  for (let t = 0.05; t <= 1.0001; t += 0.05) { const c = mix(colour, end, t); if (contrastRatio(c, against) >= min) return c; }
  return end;
}

/** How a colour looks to a reader with each common kind of colour-blindness (Machado et al. 2009, severity 1.0, linear RGB). */
export const COLOUR_VISION = ["DEUTERANOPIA", "PROTANOPIA", "TRITANOPIA"] as const;
export type ColourVision = (typeof COLOUR_VISION)[number];
const MATRIX: Record<ColourVision, readonly number[]> = {
  DEUTERANOPIA: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  PROTANOPIA: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  TRITANOPIA: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};
const lin = (v: number): number => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const unlin = (c: number): number => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);

export function simulate(hex: string, vision: ColourVision): string {
  const [r, g, b] = parseHex(hex).map(lin) as [number, number, number];
  const m = MATRIX[vision];
  return toHex([unlin(m[0]! * r + m[1]! * g + m[2]! * b), unlin(m[3]! * r + m[4]! * g + m[5]! * b), unlin(m[6]! * r + m[7]! * g + m[8]! * b)]);
}

function lab(hex: string): readonly [number, number, number] {
  const [r, g, b] = parseHex(hex).map(lin) as [number, number, number];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** Perceptual distance (CIE76 ΔE): about 2.3 is a just-noticeable difference; for chart series we ask for much more. */
export function distance(a: string, b: string): number {
  const x = lab(a), y = lab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
