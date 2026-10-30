/**
 * The colours of a number tile. Each has white text on it and every pair is checked to reach WCAG AA for small text (4.5:1), so the unit
 * line under the big figure is as readable as the figure. A colour is never the only signal: the tile always carries its name.
 */
import type { TileColor } from "@donordesk/domain/contexts/dashboards/index.js";

export const TILE_BACKGROUND: Readonly<Record<TileColor, string>> = {
  ORANGE: "#c2410c", GREEN: "#15803d", GREY: "#475569", PURPLE: "#7e22ce", BLUE: "#1d4ed8", RED: "#b91c1c",
};
export const TILE_COLOR_LABEL: Readonly<Record<TileColor, string>> = { ORANGE: "Orange", GREEN: "Green", GREY: "Grey", PURPLE: "Purple", BLUE: "Blue", RED: "Red" };

const channel = (v: number): number => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (hex: string): number => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
/** WCAG contrast ratio of white text on a background. */
export const contrastWithWhite = (background: string): number => 1.05 / (luminance(background) + 0.05);
