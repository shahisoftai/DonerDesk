/** Shapes and icons, painted from their models (Phase 48.14). Colours come from the page's theme; a shape with no colour is an outline. */
import type { ToneName } from "@donordesk/domain";
import { icon, r } from "../../infographics/kit.js";
import type { RenderCtx, Slot } from "../../infographics/kit.js";
import type { PrintPainter } from "../print-types.js";

interface ShapeModel { shape: string; tone: ToneName; label?: string }
interface IconModel { iconId: string; tone: ToneName; label?: string }

const colourOf = (c: RenderCtx, tone: ToneName): string => ({ ACCENT: c.t.accent, ACCENT2: c.t.accent2, MUTED: c.t.muted, WARN: c.t.warn, INK: c.t.ink, NONE: c.t.line })[tone];

export const paintShape: PrintPainter<ShapeModel> = ({ model, ctx: c, width }): Slot | undefined => {
  if (model.state !== "ready") return undefined;
  const { shape, tone } = model.model;
  const colour = colourOf(c, tone);
  const fill = tone === "NONE" ? "none" : colour;
  const s = c.s;
  if (shape === "LINE") return { svg: `<line x1="0" y1="${r(10 * s)}" x2="${r(width)}" y2="${r(10 * s)}" stroke="${colour}" stroke-width="${r(3 * s)}" stroke-linecap="round"/>`, width, height: 22 * s };
  if (shape === "ARROW") {
    const y = 14 * s;
    return { svg: `<line x1="0" y1="${r(y)}" x2="${r(width - 14 * s)}" y2="${r(y)}" stroke="${colour}" stroke-width="${r(3 * s)}" stroke-linecap="round"/><path d="M${r(width)} ${r(y)} L${r(width - 16 * s)} ${r(y - 9 * s)} L${r(width - 16 * s)} ${r(y + 9 * s)} Z" fill="${colour}"/>`, width, height: 28 * s };
  }
  const h = Math.min(Math.max(width * 0.45, 44 * s), 220 * s);
  const stroke = tone === "NONE" ? ` stroke="${colour}" stroke-width="${r(2 * s)}"` : "";
  if (shape === "ELLIPSE") return { svg: `<ellipse cx="${r(width / 2)}" cy="${r(h / 2)}" rx="${r(width / 2 - 1)}" ry="${r(h / 2 - 1)}" fill="${fill}"${stroke}/>`, width, height: h };
  const rx = shape === "ROUNDED" ? c.t.radius : 0;
  return { svg: `<rect x="1" y="1" width="${r(width - 2)}" height="${r(h - 2)}" rx="${rx}" fill="${fill}"${stroke}/>`, width, height: h };
};

export const paintIcon: PrintPainter<IconModel> = ({ model, ctx: c, width }): Slot | undefined => {
  if (model.state !== "ready") return undefined;
  const size = Math.min(width, 64 * c.s);
  return { svg: icon(c, model.model.iconId, 0, 0, size, colourOf(c, model.model.tone === "NONE" ? "INK" : model.model.tone)), width, height: size + 6 * c.s };
};
