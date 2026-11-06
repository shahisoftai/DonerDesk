/** Reach, activities and the two by-place tables, painted from their models (Phase 45.2). */
import type { ModelOf } from "@donordesk/domain";
import { activitiesByLocationModel, locationComparisonModel, locationResultsModel, reachModel } from "@donordesk/domain";
import { fmt, framed, notReported, r, text, wrapText } from "../../infographics/kit.js";
import type { PrintPainter } from "../print-types.js";

type Reach = ModelOf<typeof reachModel>;
export const paintReach: PrintPainter<Reach> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 96);
  const { overallUnique, registeredTotal, rows, attendances } = model.model;
  const { l, t, s } = c;
  const height = (74 + rows.length * 20 + 34) * s;
  let body = text(c, 16 * s, 28 * s, `${fmt(c, overallUnique)} ${l.uniquePeople}`, { size: 16 * s, bold: true });
  body += text(c, 16 * s, 46 * s, `${fmt(c, registeredTotal)} ${l.registeredInTotal}`, { size: 10 * s, fill: t.muted });
  const max = Math.max(1, ...rows.map((x) => x.unique));
  const barX = 150 * s;
  const barMax = Math.max(40, width - barX - 90 * s);
  rows.forEach((x, i) => {
    const y = (70 + i * 20) * s;
    body += text(c, 16 * s, y + 11 * s, wrapText(x.location, barX - 24 * s, 10.5 * s, 1)[0] ?? x.location, { size: 10.5 * s });
    body += `<rect x="${r(barX)}" y="${r(y)}" width="${r((x.unique / max) * barMax)}" height="${r(12 * s)}" rx="${r(6 * s)}" fill="${t.accent2}"/>`;
    body += text(c, barX + (x.unique / max) * barMax + 8 * s, y + 11 * s, fmt(c, x.unique), { size: 10.5 * s });
  });
  body += text(c, width - 16 * s, height - 12 * s, `${fmt(c, attendances)} ${l.attendancesNote}`, { size: 9.5 * s, fill: t.muted, anchor: "end" });
  return framed(c, title, width, height, body);
};

type Activities = ModelOf<typeof activitiesByLocationModel>;
export const paintActivitiesByLocation: PrintPainter<Activities> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 84);
  const { rows: shown, unlocated } = model.model;
  const { l, t, s } = c;
  const height = (30 + shown.length * 30 + (unlocated > 0 ? 28 : 14)) * s;
  const max = Math.max(1, ...shown.map((x) => x.planned));
  const barX = 200 * s;
  const barMax = Math.max(40, width - barX - 200 * s);
  let body = "";
  shown.forEach((x, i) => {
    const y = (18 + i * 30) * s;
    body += text(c, 16 * s, y + 12 * s, wrapText(x.location, barX - 24 * s, 11 * s, 1)[0] ?? x.location, { size: 11 * s });
    body += `<rect x="${r(barX)}" y="${r(y)}" width="${r(barMax)}" height="${r(16 * s)}" rx="${r(8 * s)}" fill="${t.accentSoft}"/>`;
    if (x.done > 0) body += `<rect x="${r(barX)}" y="${r(y)}" width="${r(Math.max(16 * s, (x.done / max) * barMax))}" height="${r(16 * s)}" rx="${r(8 * s)}" fill="${t.accent}"/>`;
    body += text(c, width - 16 * s, y + 12 * s, `${x.done} / ${x.planned} ${l.done}${x.late ? ` · ${x.late} ${l.late}` : ""}`, { size: 10.5 * s, fill: t.muted, anchor: "end" });
  });
  if (unlocated > 0) body += text(c, 16 * s, height - 10 * s, `${unlocated} ${l.activitiesWithoutLocation}`, { size: 9.5 * s, fill: t.subtle });
  return framed(c, title, width, height, body);
};

type Results = ModelOf<typeof locationResultsModel>;
export const paintLocationResults: PrintPainter<Results> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 84);
  const { l, t, s } = c;
  const lineH = 27 * s;
  let body = "";
  let row = 30 * s;
  body += text(c, 16 * s, row, l.location, { size: 10 * s, fill: t.muted, bold: true });
  body += text(c, width - 210 * s, row, l.target, { size: 10 * s, fill: t.muted, bold: true, anchor: "end" });
  body += text(c, width - 110 * s, row, l.achieved, { size: 10 * s, fill: t.muted, bold: true, anchor: "end" });
  body += text(c, width - 16 * s, row, l.percentOfTarget, { size: 10 * s, fill: t.muted, bold: true, anchor: "end" });
  for (const x of model.model.rows) {
    row += lineH;
    const actualFill = x.verified === false ? t.warn : t.ink;
    body += text(c, 16 * s, row, wrapText(`${x.indicator} ${x.location}`, width - 300 * s, 11.5 * s, 1, true)[0] ?? x.location, { size: 11.5 * s, bold: true });
    body += text(c, width - 210 * s, row, x.target ?? l.notPlanned, { size: 11.5 * s, anchor: "end", fill: x.target ? t.ink : t.subtle });
    body += text(c, width - 110 * s, row, x.actual ?? l.notReported, { size: 11.5 * s, anchor: "end", fill: x.actual ? actualFill : t.subtle });
    body += text(c, width - 16 * s, row, x.percentOfTarget ? `${x.percentOfTarget}%` : "—", { size: 11.5 * s, anchor: "end", fill: x.percentOfTarget ? t.ink : t.subtle });
    body += `<line x1="${r(12 * s)}" y1="${r(row + 9 * s)}" x2="${r(width - 12 * s)}" y2="${r(row + 9 * s)}" stroke="${t.line}"/>`;
  }
  return framed(c, title, width, row - 6 * s + 24 * s, body);
};

type Comparison = ModelOf<typeof locationComparisonModel>;
export const paintLocationComparison: PrintPainter<Comparison> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 84);
  const { columns, rows } = model.model;
  const { t, s } = c;
  const first = 160 * s;
  const colW = Math.min(200 * s, (width - first) / columns.length);
  let body = "";
  columns.forEach((col, i) => {
    body += text(c, first + i * colW, 28 * s, wrapText(`${col.code} ${col.name}`, colW - 8 * s, 9.5 * s, 1, true)[0] ?? col.code, { size: 9.5 * s, fill: t.muted, bold: true });
  });
  let y = 46 * s;
  for (const row of rows) {
    body += text(c, 16 * s, y, wrapText(row.location, first - 24 * s, 11.5 * s, 1, true)[0] ?? row.location, { size: 11.5 * s, bold: true });
    row.cells.forEach((cell, i) => {
      body += text(c, first + i * colW, y, cell ? cell.value : "—", { size: 11.5 * s, fill: cell ? (cell.verified ? t.ink : t.warn) : t.subtle });
    });
    y += 26 * s;
  }
  return framed(c, title, width, y - 8 * s + 12 * s, body);
};
