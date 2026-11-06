/** Big numbers, progress rings and the funnel, painted from their models (Phase 45.2). The drawing is the Studio's own; only the source of the figures changed. */
import type { ModelOf } from "@donordesk/domain";
import { bigNumbersModel, funnelModel, progressRingsModel } from "@donordesk/domain";
import { arcPath, fmt, framed, headingHeight, icon, mixHex, notReported, onColor, paragraph, previewHint, r, text, wrapText } from "../../infographics/kit.js";
import type { RenderCtx } from "../../infographics/kit.js";
import type { PrintInput, PrintPainter } from "../print-types.js";

type Cards = ModelOf<typeof bigNumbersModel>;
type Card = Cards["cards"][number];
const NO_FIGURE = "Add the figures to show";

/** The words a card shows for its figure: typed figures as written, recorded ones formatted, and "not yet reported" for none. */
function cardFigure(c: RenderCtx, card: Card, rounding: Cards["rounding"]): { value: string; detail?: string; muted: boolean } {
  const f = card.figure;
  if (!f) return { value: c.l.notYetReported, muted: true };
  const detail = f.unverified ? c.l.notVerifiedYet : undefined;
  const shown = card.source === "MANUAL" ? f.text : f.amount !== null ? fmt(c, f.amount, rounding) : f.text;
  return { value: `${f.prefix ? `${f.prefix} ` : ""}${shown}${f.suffix ?? ""}`, ...(detail ? { detail } : {}), muted: false };
}

export const paintBigNumbers: PrintPainter<Cards> = ({ model, ctx: c, title, width }) => {
  if (model.state === "empty") return previewHint(c, title, width, NO_FIGURE);
  if (model.state !== "ready") return notReported(c, title, width);
  const { cards, sources, rounding } = model.model;
  const { t, s } = c;
  const gap = c.grid.gap;
  const n = cards.length;
  const perRow = width < 560 * s ? Math.min(n, 2) : Math.min(n, 6);
  const rows = Math.ceil(n / perRow);
  const cardW = (width - 24 * s - gap * (perRow - 1)) / perRow;
  const cardH = 112 * s;
  const bodyH = rows * cardH + (rows - 1) * gap + 24 * s;
  let body = "";
  cards.forEach((card, i) => {
    const x = 12 * s + (i % perRow) * (cardW + gap);
    const y = 12 * s + Math.floor(i / perRow) * (cardH + gap);
    const resolved = cardFigure(c, card, rounding);
    body += `<rect x="${r(x)}" y="${r(y)}" width="${r(cardW)}" height="${r(cardH)}" rx="${r(Math.min(8, t.radius))}" fill="${t.surface}"/>`;
    const tx = x + 14 * s;
    if (card.iconId) body += icon(c, card.iconId, x + 14 * s, y + 14 * s, 26 * s, t.accent);
    const valueSize = resolved.muted ? 13 * s : Math.min(34 * s, Math.max(16 * s, ((cardW - 28 * s) / Math.max(resolved.value.length, 3)) * 1.55));
    const vy = card.iconId ? y + 66 * s : y + 46 * s;
    body += text(c, tx, vy, resolved.value, { size: valueSize, bold: !resolved.muted, fill: resolved.muted ? t.subtle : t.ink, italic: resolved.muted });
    wrapText(card.label, cardW - 28 * s, 10.5 * s, 2).forEach((line, li) => (body += text(c, tx, vy + 16 * s + li * 13 * s, line, { size: 10.5 * s, fill: t.muted })));
    const foot = card.caption ?? resolved.detail ?? "";
    if (foot) body += text(c, tx, y + cardH - 8 * s, wrapText(foot, cardW - 28 * s, 8.5 * s, 1)[0] ?? foot, { size: 8.5 * s, fill: resolved.detail ? t.warn : t.muted });
  });
  const slot = framed(c, title, width, bodyH, body);
  if (sources.length === 0) return slot;
  const p = paragraph(c, 0, 0, `${c.l.source}: ${sources.join("; ")}`, width, { size: 8.5 * s, maxLines: 2, fill: t.muted });
  const y = headingHeight(c, title) + bodyH + 4 * s;
  return { svg: `${slot.svg}<g transform="translate(0 ${r(y)})">${p.svg}</g>`, width, height: y + p.height + 12 * s };
};

type Rings = ModelOf<typeof progressRingsModel>;
export const paintProgressRings: PrintPainter<Rings> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 110);
  const picked = model.model.rings;
  const { t, s } = c;
  const perRow = Math.max(1, Math.min(picked.length, Math.floor(width / (170 * s))));
  const cellW = width / perRow;
  const rows = Math.ceil(picked.length / perRow);
  const cellH = 168 * s;
  let body = "";
  picked.forEach((ind, i) => {
    const cx = (i % perRow) * cellW + cellW / 2;
    const top = Math.floor(i / perRow) * cellH + 14 * s;
    const R = 44 * s;
    const cy = top + R + 4 * s;
    const shown = ind.amount !== null ? fmt(c, ind.amount) : ind.text;
    body += `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(R)}" fill="none" stroke="${t.accentSoft}" stroke-width="${r(12 * s)}"/>`;
    if (ind.percent !== null) {
      const frac = Math.min(ind.percent / 100, 1);
      if (frac > 0) body += `<path d="${arcPath(cx, cy, R, frac)}" fill="none" stroke="${ind.percent >= 100 ? t.signals.ON_TIME : t.accent}" stroke-width="${r(12 * s)}" stroke-linecap="round"/>`;
      body += text(c, cx, cy + 7 * s, `${Math.round(ind.percent)}%`, { size: 20 * s, bold: true, anchor: "middle" });
    } else {
      body += text(c, cx, cy + 6 * s, `${shown}${ind.unit === "%" ? "%" : ""}`, { size: 17 * s, bold: true, anchor: "middle" });
    }
    const name = wrapText(`${ind.code} ${ind.name}`, cellW - 20 * s, 10.5 * s, 2, true);
    name.forEach((line, li) => (body += text(c, cx, cy + R + 22 * s + li * 13 * s, line, { size: 10.5 * s, bold: true, anchor: "middle" })));
    const sub = ind.percent !== null && ind.target !== null ? `${shown} / ${fmt(c, ind.target)}` : ind.isRate ? c.l.latest : "";
    if (sub) body += text(c, cx, cy + R + 22 * s + name.length * 13 * s + 2 * s, sub, { size: 9.5 * s, fill: ind.verified ? t.muted : t.warn, anchor: "middle" });
  });
  return framed(c, title, width, rows * cellH + 10 * s, body);
};

type Funnel = ModelOf<typeof funnelModel>;
export const paintFunnel: PrintPainter<Funnel> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return previewHint(c, title, width, "Add people in need, targeted and reached");
  const { stages, sources, recorded } = model.model;
  if (!recorded && !c.preview) return undefined;
  const { t, s } = c;
  const max = Math.max(1, ...stages.map((x) => x.amount ?? 0));
  const rowH = 54 * s;
  const bodyH = stages.length * rowH + 20 * s;
  const maxBar = width - 48 * s;
  let body = "";
  stages.forEach((stage, i) => {
    const y = 14 * s + i * rowH;
    const w = stage.amount === null ? 0 : Math.max(maxBar * 0.12, (stage.amount / max) * maxBar);
    const x = 24 * s + (maxBar - w) / 2;
    const shade = mixHex(t.accent, "#ffffff", Math.min(0.62, i * 0.2));
    if (stage.amount !== null) {
      body += `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(rowH - 14 * s)}" rx="${r(Math.min(6, t.radius))}" fill="${shade}"/>`;
      body += text(c, 24 * s + maxBar / 2, y + (rowH - 14 * s) / 2 + 6 * s, fmt(c, stage.amount), { size: 20 * s, bold: true, fill: onColor(c, shade), anchor: "middle" });
    } else body += text(c, 24 * s + maxBar / 2, y + (rowH - 14 * s) / 2 + 5 * s, c.l.notYetReported, { size: 12 * s, italic: true, fill: t.subtle, anchor: "middle" });
    body += text(c, 24 * s, y + rowH - 14 * s + 11 * s, stage.label, { size: 10.5 * s, fill: t.muted, bold: true });
    if (stage.percentOfPrevious !== null) body += text(c, width - 24 * s, y + rowH - 14 * s + 11 * s, `${stage.percentOfPrevious}%`, { size: 10.5 * s, fill: t.muted, anchor: "end" });
  });
  const slot = framed(c, title, width, bodyH, body);
  if (sources.length === 0) return slot;
  const p = paragraph(c, 0, 0, `${c.l.source}: ${sources.join("; ")}`, width, { size: 8.5 * s, maxLines: 2, fill: t.muted });
  const y = headingHeight(c, title) + bodyH + 4 * s;
  return { svg: `${slot.svg}<g transform="translate(0 ${r(y)})">${p.svg}</g>`, width, height: y + p.height + 12 * s };
};

export type { PrintInput };
