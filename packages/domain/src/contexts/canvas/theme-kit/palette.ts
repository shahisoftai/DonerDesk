import { COLOUR_VISION, distance, ensureContrast, fromHsl, mix, simulate, toHsl, type ColourVision } from "./colour.js";

/**
 * Palettes and scales (Phase 48.13). A categorical palette is checked for how far apart its colours look to a reader with each kind of
 * colour-blindness; a sequential or diverging scale is built from end colours so a theme never ships a ramp that is muddy in the middle.
 */
export const MIN_SERIES_DISTANCE = 18;
export const MAX_CATEGORICAL = 12;

/** A well-spread palette from one base colour: hues are stepped around the wheel with lightness alternating, then each colour is fitted to the surface. */
export function categoricalPalette(base: string, count: number, surface = "#ffffff"): string[] {
  const n = Math.min(MAX_CATEGORICAL, Math.max(1, Math.round(count)));
  const { h, s, l } = toHsl(base);
  const golden = 137.508;
  return Array.from({ length: n }, (_, i) => ensureContrast(fromHsl(h + i * golden, Math.min(0.85, Math.max(0.45, s)), i % 2 === 0 ? Math.min(0.5, Math.max(0.38, l)) : 0.58), surface, 3));
}

export interface PaletteProblem { vision: ColourVision | "NORMAL"; a: number; b: number; distance: number }

/** Pairs of colours that are too close to tell apart, for normal vision and for each kind of colour-blindness. */
export function paletteProblems(colours: readonly string[], min = MIN_SERIES_DISTANCE): PaletteProblem[] {
  const out: PaletteProblem[] = [];
  const views: Array<[PaletteProblem["vision"], string[]]> = [["NORMAL", [...colours]], ...COLOUR_VISION.map((v): [ColourVision, string[]] => [v, colours.map((c) => simulate(c, v))])];
  for (const [vision, seen] of views) for (let a = 0; a < seen.length; a++) for (let b = a + 1; b < seen.length; b++) {
    const d = distance(seen[a]!, seen[b]!);
    if (d < min) out.push({ vision, a, b, distance: Math.round(d * 10) / 10 });
  }
  return out;
}

/** Keeps the first colours that stay apart from every earlier one under all four views; the rest are dropped. */
export function distinguishable(colours: readonly string[], min = MIN_SERIES_DISTANCE): string[] {
  const kept: string[] = [];
  for (const c of colours) if (paletteProblems([...kept, c], min).length === 0) kept.push(c);
  return kept;
}

/** `steps` colours from `from` to `to`, evenly mixed in Lab-like lightness order (a straight mix keeps it predictable and monotonic). */
export function sequentialScale(from: string, to: string, steps: number): string[] {
  const n = Math.max(2, Math.min(15, Math.round(steps)));
  return Array.from({ length: n }, (_, i) => mix(from, to, i / (n - 1)));
}

/** Two ramps meeting at a neutral midpoint (an odd number of steps keeps the midpoint exact). */
export function divergingScale(negative: string, midpoint: string, positive: string, steps: number): string[] {
  const n = Math.max(3, Math.min(15, Math.round(steps) % 2 === 0 ? Math.round(steps) + 1 : Math.round(steps)));
  const half = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => (i < half ? mix(negative, midpoint, i / half) : i === half ? midpoint : mix(midpoint, positive, (i - half) / half)));
}
