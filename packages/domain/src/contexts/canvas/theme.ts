/**
 * One theme table for dashboards and infographics (Phase 45.4). The infographic themes become the canvas themes, so a dashboard
 * can wear a brand or print theme and an infographic can follow the screen's colour mode. `contrastProblems` is the one check
 * the editor, the brand kit and the tests run.
 */
import { INFOGRAPHIC_THEME_ORDER, INFOGRAPHIC_THEMES, contrastRatio, resolveTheme, type InfographicTheme } from "../infographics/theme.js";
import { GALLERY_IDS } from "./theme-kit/gallery.js";
import { buildTheme } from "./theme-kit/build-theme.js";

export type CanvasTheme = InfographicTheme;
export const CANVAS_THEME_IDS: readonly string[] = [...INFOGRAPHIC_THEME_ORDER, ...GALLERY_IDS];
export const DEFAULT_THEME_ID = "DEFAULT";

export const themeFor = (themeId: string | undefined, brand?: CanvasTheme): CanvasTheme => resolveTheme(themeId, brand);
export const listThemes = (): CanvasTheme[] => [...INFOGRAPHIC_THEME_ORDER.map((id) => INFOGRAPHIC_THEMES[id]), ...GALLERY_IDS.map((id) => resolveTheme(id))];

export interface ContrastProblem { pair: string; ratio: number; needed: number }
/** Text pairs need 4.5:1; rules and marks 3:1. A brand theme that fails is refused before it is saved. */
export function contrastProblems(theme: CanvasTheme): ContrastProblem[] {
  const pairs: Array<[string, string, string, number]> = [
    ["body on page", theme.body, theme.page, 4.5], ["ink on page", theme.ink, theme.page, 4.5], ["body on card", theme.body, theme.card, 4.5],
    ["muted on card", theme.muted, theme.card, 4.5], ["accent on card", theme.accent, theme.card, 3], ["warn on card", theme.warn, theme.card, 4.5],
  ];
  return pairs.map(([pair, fg, bg, needed]) => ({ pair, ratio: contrastRatio(fg, bg), needed })).filter((p) => p.ratio < p.needed);
}

/** The id a canvas uses for a theme loaded from a file (Phase 50.5). */
export const CUSTOM_THEME_ID = "CUSTOM";
/** A canvas's own theme: the one loaded from a file when it chose it, else the named one. A file theme is rebuilt from its spec, so every contrast rule holds. */
const CUSTOM_BUILT = new WeakMap<object, CanvasTheme>();
export const canvasThemeOf = (c: { themeId: string; options?: { themeSpec?: import("./theme-kit/build-theme.js").ThemeSpec | undefined } | undefined }): CanvasTheme => {
  const spec = c.themeId === CUSTOM_THEME_ID ? c.options?.themeSpec : undefined;
  if (!spec) return themeFor(c.themeId);
  // Every block asks for the page's theme: build a file's theme once per spec, not once per block and render.
  let built = CUSTOM_BUILT.get(spec);
  if (!built) { built = buildTheme(spec); CUSTOM_BUILT.set(spec, built); }
  return built;
};
