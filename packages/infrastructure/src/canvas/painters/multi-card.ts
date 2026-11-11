/** The figure card painted from its model (Phase 50.3): the same figures the screen shows; a figure nobody recorded reads "not yet reported", never 0. */
import { formatFigure, type MultiCardModel } from "@donordesk/domain";
import { framed, notReported, previewHint, text, wrapText } from "../../infographics/kit.js";
import type { PrintPainter } from "../print-types.js";

export const paintMultiCard: PrintPainter<MultiCardModel> = ({ model, ctx: c, title, width }) => {
  if (model.state === "empty") return previewHint(c, title, width, "Add the figures to show");
  if (model.state !== "ready") return notReported(c, title, width);
  const { items, columns, layout, header } = model.model;
  const { t, s } = c;
  const per = layout === "ROW" ? Math.max(1, items.length) : layout === "COLUMN" ? 1 : Math.max(1, columns);
  const rows = Math.ceil(items.length / per);
  const cellW = (width - 24 * s) / per;
  const cellH = 54 * s;
  const top = header ? 22 * s : 0;
  let body = header ? text(c, 12 * s, 18 * s, header, { size: 12 * s, bold: true, fill: t.ink }) : "";
  items.forEach((it, i) => {
    const x = 12 * s + (i % per) * cellW;
    const y = top + 12 * s + Math.floor(i / per) * cellH;
    const shown = formatFigure(it.value, {}, c.lang);
    body += text(c, x, y + 22 * s, shown ?? c.l.notYetReported, { size: shown === null ? 11 * s : 20 * s, bold: shown !== null, italic: shown === null, fill: shown === null ? t.subtle : t.ink });
    body += text(c, x, y + 38 * s, wrapText(it.label, cellW - 8 * s, 9.5 * s, 1)[0] ?? it.label, { size: 9.5 * s, fill: t.muted });
  });
  const bodyH = top + rows * cellH + 18 * s;
  if (model.model.unverifiedCount > 0) body += text(c, 12 * s, bodyH - 6 * s, c.l.notVerifiedYet, { size: 8.5 * s, fill: t.warn });
  return framed(c, title, width, bodyH, body);
};
