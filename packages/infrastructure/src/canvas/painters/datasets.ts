/**
 * Dataset blocks in a file (Phase 54). A file holds what was read when it was made: a dataset visual is written as its table of figures
 * (title, groups, figures, gaps as "Not reported"), completeness as its grid, differences as their sentences. A slicer is interactive only
 * and is left out, like the filter bar.
 */
import type { BlockModel, DataCompletenessModel, DataDriversModel, DataVisualModel } from "@donordesk/domain";
import { framed, paragraph, text } from "../../infographics/kit.js";
import type { PrintPainter } from "../print-types.js";

const MAX_ROWS = 14;
const cell = (v: unknown, rate: boolean): string => (typeof v === "number" ? `${v.toLocaleString("en", { maximumFractionDigits: rate ? 1 : 2 })}${rate ? " %" : ""}` : v === null || v === undefined || v === "" ? "Not reported" : String(v));

export const paintDataVisual: PrintPainter<DataVisualModel> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return undefined;
  const m = model.model;
  const cols = m.table.columns.slice(0, 5);
  const colW = (width - 32 * c.s) / Math.max(1, cols.length);
  const line = 18 * c.s;
  let svg = cols.map((col, i) => text(c, 16 * c.s + i * colW, 18 * c.s, col.label, { size: 10 * c.s, bold: true, fill: c.t.muted })).join("");
  m.table.rows.slice(0, MAX_ROWS).forEach((row, k) => {
    svg += cols.map((col, i) => text(c, 16 * c.s + i * colW, 18 * c.s + (k + 1) * line, cell(row[col.id], col.type === "RATE"), { size: 10.5 * c.s, fill: c.t.ink })).join("");
  });
  const notes = [...(m.table.rows.length > MAX_ROWS ? [`First ${MAX_ROWS} of ${m.table.rows.length} rows.`] : []), ...m.references.map((x) => `Reference: ${x.label}${x.value !== undefined ? ` (${x.value})` : ""}${x.source ? `, ${x.source}` : ""}.`), ...model.notes].join(" ");
  const top = 18 * c.s + (Math.min(MAX_ROWS, m.table.rows.length) + 1) * line;
  const para = paragraph(c, 16 * c.s, top + 6 * c.s, notes, width - 32 * c.s, { size: 9 * c.s, maxLines: 4, fill: c.t.muted, lineHeight: 12 * c.s });
  return framed(c, title ?? m.title, width, top + para.height + 18 * c.s, `<g>${svg}</g>${para.svg}`, c.t.surface);
};

export const paintDataCompleteness: PrintPainter<DataCompletenessModel> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return undefined;
  const m = model.model;
  const periods = m.periods.slice(-6);
  const colW = (width - 140 * c.s) / Math.max(1, periods.length);
  const line = 18 * c.s;
  let svg = periods.map((p, i) => text(c, 130 * c.s + i * colW, 18 * c.s, p, { size: 10 * c.s, bold: true, fill: c.t.muted })).join("");
  m.groups.slice(0, MAX_ROWS).forEach((g, k) => {
    const y = 18 * c.s + (k + 1) * line;
    svg += text(c, 16 * c.s, y, g, { size: 10.5 * c.s, bold: true, fill: c.t.ink });
    svg += periods.map((p, i) => { const x = m.cells.find((q) => q.group === g && q.period === p); return text(c, 130 * c.s + i * colW, y, x ? `${x.reported}/${x.expected}` : "", { size: 10.5 * c.s, fill: c.t.ink }); }).join("");
  });
  const h = 18 * c.s + (Math.min(MAX_ROWS, m.groups.length) + 1) * line + 12 * c.s;
  return framed(c, title, width, h, `<g>${svg}</g>`, c.t.surface);
};

export const paintDataDrivers: PrintPainter<DataDriversModel> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return undefined;
  const lines = model.model.results.map((x) => (x.status === "RANKED" ? x.sentence : x.reason)).join(" ");
  const para = paragraph(c, 16 * c.s, 16 * c.s, lines || "No group differs enough to show.", width - 32 * c.s, { size: 11 * c.s, maxLines: 14, fill: c.t.body, lineHeight: 15 * c.s });
  return framed(c, title, width, para.height + 32 * c.s, para.svg, c.t.surface);
};

export type { BlockModel };
