/** The structure blocks, painted from their models (Phase 45.2). A callout and the text blocks are drawn; a repeater and a filter bar are interactive only, so a file leaves them out. */
import type { BlockModel } from "@donordesk/domain";
import { framed, paragraph, r, text, type Slot } from "../../infographics/kit.js";
import type { PrintPainter } from "../print-types.js";

export const paintCallout: PrintPainter<{ text: string; tone: string }> = ({ model, ctx: c, width }) => {
  if (model.state !== "ready" || !model.model.text.trim()) return undefined;
  const { t, s } = c;
  const tone = model.model.tone === "good" ? t.signals.ON_TIME : model.model.tone === "warn" ? t.warn : t.accent;
  const size = 12.5 * s;
  const para = paragraph(c, 18 * s, 16 * s, model.model.text, width - 36 * s, { size, maxLines: 6, fill: t.ink, lineHeight: size * 1.45 });
  const h = para.height + 24 * s;
  return { svg: `<rect x="0" y="0" width="${r(width)}" height="${r(h)}" rx="${r(Math.min(6, t.radius))}" fill="${t.surface}"/><rect x="0" y="0" width="${r(5 * s)}" height="${r(h)}" fill="${tone}"/>${para.svg}`, width, height: h + 14 * s };
};

export const paintAiText: PrintPainter<{ text: string; accepted: boolean }> = ({ model, ctx: c, title, width }) => {
  // Only words a person accepted go into a file; a draft stays on the screen.
  if (model.state !== "ready" || !model.model.accepted) return undefined;
  const size = 12.5 * c.s;
  const para = paragraph(c, 16 * c.s, 14 * c.s, model.model.text, width - 32 * c.s, { size, maxLines: 16, fill: c.t.body, lineHeight: size * 1.45 });
  return framed(c, title, width, Math.max(56 * c.s, 30 * c.s + para.height), para.svg, c.t.surface);
};

export const paintGroup: PrintPainter<{ title?: string }> = ({ model, ctx: c, width }): Slot | undefined => {
  const name = model.state === "ready" ? model.model.title?.trim() : "";
  if (!name) return undefined;
  return { svg: `${text(c, 0, 16 * c.s, name.toUpperCase(), { size: 11 * c.s, bold: true, fill: c.t.muted })}<line x1="0" y1="${r(24 * c.s)}" x2="${r(width)}" y2="${r(24 * c.s)}" stroke="${c.t.line}"/>`, width, height: 34 * c.s };
};

export const paintTabs: PrintPainter<{ titles: string[] }> = ({ model, ctx: c, width }): Slot | undefined => {
  if (model.state !== "ready") return undefined;
  const line = model.model.titles.join("  ·  ");
  return { svg: text(c, 0, 16 * c.s, line, { size: 11 * c.s, bold: true, fill: c.t.muted }), width, height: 28 * c.s };
};

export const paintNothing: PrintPainter<unknown> = () => undefined;
export type { BlockModel };
