/**
 * A block's formatting as screen styles (Phase 50.2). The hints come from the domain's `formatHints`, which the print painter also reads,
 * so the screen and a file draw the same accent bar, border and padding. Logical sides (start, end) so Arabic mirrors. Pure.
 */
import type { FormatHints } from "@donordesk/domain/contexts/canvas/index.js";

type Css = Record<string, string | number>;
const SIDE_PROP: Record<"start" | "end" | "top" | "bottom", string> = { start: "borderInlineStart", end: "borderInlineEnd", top: "borderTop", bottom: "borderBottom" };

export function frameCss(h: FormatHints): Css {
  const css: Css = {};
  if (h.border) {
    const line = `${h.border.px}px solid ${h.border.colour}`;
    if (h.border.side === "all") css["border"] = line; else css[SIDE_PROP[h.border.side]] = line;
  }
  // The accent bar is drawn after the border so it wins on its side.
  if (h.accentBar) css[SIDE_PROP[h.accentBar.side]] = `${h.accentBar.px}px solid ${h.accentBar.colour}`;
  if (h.padding) { css["paddingTop"] = h.padding.top; css["paddingInlineEnd"] = h.padding.end; css["paddingBottom"] = h.padding.bottom; css["paddingInlineStart"] = h.padding.start; }
  if (Object.keys(css).length > 0) css["borderRadius"] = "0.75rem";
  return css;
}

export function titleCss(h: FormatHints): Css {
  return { fontSize: h.title.sizePx, fontWeight: h.title.bold ? 600 : 400, color: h.title.colour, textAlign: h.title.align, ...(h.title.rule ? { borderBottom: "1px solid currentColor", paddingBottom: 2 } : {}) };
}
