/** The four portfolio blocks, painted from their models (Phase 45.2). Same drawing as the Studio's; the counts come from the model. */
import type { ModelOf } from "@donordesk/domain";
import { portfolioCountriesModel, portfolioHealthModel, portfolioSummaryModel, portfolioTableModel } from "@donordesk/domain";
import { fmt, framed, headingHeight, notReported, paragraph, r, text, wrapText, type RenderCtx } from "../../infographics/kit.js";
import type { PrintPainter } from "../print-types.js";

const bandColor = (c: RenderCtx, band: string): string => (band === "ON_TRACK" ? c.t.signals.ON_TIME : band === "OFF_TRACK" ? c.t.signals.LATE : band === "AT_RISK" ? c.t.warn : c.t.signals.CANCELLED);
const bandLabel = (c: RenderCtx, band: string): string => (band === "ON_TRACK" ? c.l.onTrack : band === "OFF_TRACK" ? c.l.offTrack : band === "AT_RISK" ? c.l.atRisk : c.l.noPlan);
const CARD_LABEL = (c: RenderCtx): Record<string, string> => ({ projects: c.l.projectsWord, countries: c.l.countriesWord, offTrack: c.l.offTrack, atRisk: c.l.atRisk, openRisks: c.l.openRisks, reportsOverdue: c.l.reportsOverdue });

export const paintPortfolioSummary: PrintPainter<ModelOf<typeof portfolioSummaryModel>> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 84);
  const { t, s } = c;
  const { cards, asAt } = model.model;
  const labels = CARD_LABEL(c);
  const gap = c.grid.gap;
  const perRow = width < 560 * s ? 3 : 6;
  const cardW = (width - 24 * s - gap * (perRow - 1)) / perRow;
  const cardH = 84 * s;
  const rows = Math.ceil(cards.length / perRow);
  let body = "";
  cards.forEach((card, i) => {
    const x = 12 * s + (i % perRow) * (cardW + gap);
    const y = 12 * s + Math.floor(i / perRow) * (cardH + gap);
    const tone = card.tone === "LATE" ? t.signals.LATE : card.tone === "WARN" ? t.warn : undefined;
    body += `<rect x="${r(x)}" y="${r(y)}" width="${r(cardW)}" height="${r(cardH)}" rx="${r(Math.min(8, t.radius))}" fill="${t.surface}"/>`;
    body += text(c, x + 14 * s, y + 40 * s, fmt(c, card.value), { size: 28 * s, bold: true, fill: tone && card.value > 0 ? tone : t.ink });
    wrapText(labels[card.key] ?? "", cardW - 28 * s, 10.5 * s, 2).forEach((line, li) => (body += text(c, x + 14 * s, y + 58 * s + li * 13 * s, line, { size: 10.5 * s, fill: t.muted })));
  });
  const slot = framed(c, title, width, rows * cardH + (rows - 1) * gap + 24 * s, body);
  if (!asAt) return slot;
  const note = paragraph(c, 0, 0, `${c.l.asAt} ${asAt}`, width, { size: 9 * s, maxLines: 1, fill: t.muted });
  const y = headingHeight(c, title) + rows * cardH + (rows - 1) * gap + 24 * s + 4 * s;
  return { svg: `${slot.svg}<g transform="translate(0 ${r(y)})">${note.svg}</g>`, width, height: y + note.height + 12 * s };
};

export const paintPortfolioHealth: PrintPainter<ModelOf<typeof portfolioHealthModel>> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 84);
  const { s } = c;
  const parts = model.model.parts;
  const total = parts.reduce((n, x) => n + x.count, 0) || 1;
  const barW = width - 32 * s;
  let body = "";
  let x = 16 * s;
  for (const part of parts) {
    const w = (part.count / total) * barW;
    body += `<rect x="${r(x)}" y="${r(18 * s)}" width="${r(Math.max(w, 2))}" height="${r(30 * s)}" fill="${bandColor(c, part.band)}"/>`;
    if (w > 28 * s) body += text(c, x + w / 2, 38 * s, String(part.count), { size: 13 * s, bold: true, fill: "#ffffff", anchor: "middle" });
    x += w;
  }
  let y = 74 * s;
  for (const part of parts) {
    body += `<rect x="${r(16 * s)}" y="${r(y - 10 * s)}" width="${r(12 * s)}" height="${r(12 * s)}" fill="${bandColor(c, part.band)}"/>`;
    body += text(c, 34 * s, y, `${bandLabel(c, part.band)}: ${part.count}`, { size: 11.5 * s });
    y += 22 * s;
  }
  return framed(c, title, width, y - 4 * s, body);
};

export const paintPortfolioCountries: PrintPainter<ModelOf<typeof portfolioCountriesModel>> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 84);
  const { s } = c;
  const shown = model.model.countries;
  const max = Math.max(1, ...shown.map((x) => x.projects));
  const labelW = 120 * s;
  const barMax = Math.max(40, width - labelW - 70 * s);
  let body = "";
  shown.forEach((row, i) => {
    const y = 16 * s + i * 28 * s;
    body += text(c, 16 * s, y + 14 * s, wrapText(row.country, labelW - 24 * s, 11 * s, 1)[0] ?? row.country, { size: 11 * s });
    let x = labelW;
    for (const part of [{ band: "ON_TRACK", n: row.onTrack }, { band: "AT_RISK", n: row.atRisk }, { band: "OFF_TRACK", n: row.offTrack }, { band: "NO_PLAN", n: row.noPlan }].filter((q) => q.n > 0)) {
      const w = (part.n / max) * barMax;
      body += `<rect x="${r(x)}" y="${r(y + 2 * s)}" width="${r(w)}" height="${r(16 * s)}" fill="${bandColor(c, part.band)}"/>`;
      x += w;
    }
    body += text(c, x + 8 * s, y + 14 * s, String(row.projects), { size: 11 * s, bold: true });
  });
  return framed(c, title, width, 16 * s + shown.length * 28 * s + 8 * s, body);
};

export const paintPortfolioTable: PrintPainter<ModelOf<typeof portfolioTableModel>> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 84);
  const { t, s, l } = c;
  const { rows, more } = model.model;
  const col = { name: 16 * s, country: width * 0.38, donor: width * 0.52, health: width * 0.72, next: width - 16 * s };
  let body = "";
  let y = 26 * s;
  const head = (x: number, label: string, anchor?: "end"): void => void (body += text(c, x, y, label, { size: 10 * s, bold: true, fill: t.muted, ...(anchor ? { anchor } : {}) }));
  head(col.name, l.project); head(col.country, l.country); head(col.donor, l.donor); head(col.health, l.health); head(col.next, l.nextReport, "end");
  for (const row of rows) {
    y += 28 * s;
    body += text(c, col.name, y, wrapText(row.title, col.country - col.name - 12 * s, 11 * s, 1, true)[0] ?? row.title, { size: 11 * s, bold: true });
    body += text(c, col.country, y, wrapText(row.country, col.donor - col.country - 10 * s, 11 * s, 1)[0] ?? "", { size: 11 * s });
    body += text(c, col.donor, y, wrapText(row.donorName, col.health - col.donor - 10 * s, 11 * s, 1)[0] ?? "", { size: 11 * s, fill: t.body });
    body += `<circle cx="${r(col.health + 5 * s)}" cy="${r(y - 4 * s)}" r="${r(5 * s)}" fill="${bandColor(c, row.band)}"/>`;
    body += text(c, col.health + 16 * s, y, wrapText(bandLabel(c, row.band), col.next - col.health - 130 * s, 11 * s, 1)[0] ?? "", { size: 11 * s });
    const late = row.nextReport !== null && row.nextReport.daysUntil < 0;
    const next = row.nextReport ? `${row.nextReport.deadline}${late ? ` · ${Math.abs(row.nextReport.daysUntil)}d ${l.late}` : ""}` : "—";
    body += text(c, col.next, y, next, { size: 11 * s, anchor: "end", fill: late ? t.signals.LATE : t.body });
    body += `<line x1="${r(12 * s)}" y1="${r(y + 10 * s)}" x2="${r(width - 12 * s)}" y2="${r(y + 10 * s)}" stroke="${t.line}"/>`;
  }
  if (more > 0) { y += 24 * s; body += text(c, 16 * s, y, `+${more}`, { size: 10 * s, fill: t.muted }); }
  return framed(c, title, width, y + 14 * s, body);
};
