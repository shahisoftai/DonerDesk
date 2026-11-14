import type { OptionTheme } from "@donordesk/domain/contexts/canvas/index.js";

/** The colours a dataset chart draws with: the page's viz tokens, read from the stylesheet so a theme or dark mode applies. */
const FALLBACK: OptionTheme = { palette: ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#db2777", "#4b5563", "#059669", "#dc2626"], text: "#1f2937", muted: "#586a62", grid: "#e5e7eb", good: "#059669", bad: "#dc2626" };

export function chartTheme(el?: Element | null): OptionTheme {
  if (typeof window === "undefined" || !el) return FALLBACK;
  const css = getComputedStyle(el);
  const v = (name: string): string => css.getPropertyValue(name).trim();
  const palette = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--viz-${i}`)).filter(Boolean);
  return { palette: palette.length >= 4 ? palette : FALLBACK.palette, text: v("--text") || FALLBACK.text, muted: v("--text-muted") || FALLBACK.muted, grid: v("--border") || FALLBACK.grid, good: v("--signal-good") || FALLBACK.good, bad: v("--signal-bad") || FALLBACK.bad };
}
