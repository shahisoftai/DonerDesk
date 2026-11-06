/**
 * Portfolio blocks and the who-does-what-where matrix (Phase 32). A portfolio block draws the same portfolio read the
 * dashboard shows: a project's delivery band as a label, counts side by side, nothing combined into a score and nothing
 * summed that the dashboard does not sum. The matrix is typed by the author (with its source) and grouped with the product's
 * one location normalizer, so "Gulu" and "Gulu District" are one column.
 */
import { normalizeLocationKey, UN_MAP_DISCLAIMER, type InfographicSectionConfig } from "@donordesk/domain";
import { fmt, framed, headingHeight, heading, notReported, paragraph, previewHint, r, text, textWidth, wrapText, type RenderCtx, type Slot } from "./kit.js";
import { titleFor } from "./blocks-core.js";

void UN_MAP_DISCLAIMER;

const bandColor = (c: RenderCtx, band: string): string => (band === "ON_TRACK" ? c.t.signals.ON_TIME : band === "OFF_TRACK" ? c.t.signals.LATE : band === "AT_RISK" ? c.t.warn : c.t.signals.CANCELLED);
const bandLabel = (c: RenderCtx, band: string): string => (band === "ON_TRACK" ? c.l.onTrack : band === "OFF_TRACK" ? c.l.offTrack : band === "AT_RISK" ? c.l.atRisk : c.l.noPlan);

export function portfolioSummaryBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const p = c.portfolio;
  if (!p || p.rows.length === 0) return notReported(c, title, width, 84);
  const { t, s } = c;
  const cards: Array<{ value: number; label: string; tone?: string }> = [
    { value: p.totals.projects, label: c.l.projectsWord },
    { value: p.totals.countries, label: c.l.countriesWord },
    { value: p.totals.behind, label: c.l.offTrack, tone: t.signals.LATE },
    { value: p.totals.needAttention, label: c.l.atRisk, tone: t.warn },
    { value: p.totals.openRisks, label: c.l.openRisks },
    { value: p.totals.reportsOverdue, label: c.l.reportsOverdue },
  ];
  const gap = c.grid.gap;
  const perRow = width < 560 * s ? 3 : 6;
  const cardW = (width - 24 * s - gap * (perRow - 1)) / perRow;
  const cardH = 84 * s;
  const rows = Math.ceil(cards.length / perRow);
  let body = "";
  cards.forEach((card, i) => {
    const x = 12 * s + (i % perRow) * (cardW + gap);
    const y = 12 * s + Math.floor(i / perRow) * (cardH + gap);
    body += `<rect x="${r(x)}" y="${r(y)}" width="${r(cardW)}" height="${r(cardH)}" rx="${r(Math.min(8, t.radius))}" fill="${t.surface}"/>`;
    body += text(c, x + 14 * s, y + 40 * s, fmt(c, card.value), { size: 28 * s, bold: true, fill: card.tone && card.value > 0 ? card.tone : t.ink });
    wrapText(card.label, cardW - 28 * s, 10.5 * s, 2).forEach((line, li) => (body += text(c, x + 14 * s, y + 58 * s + li * 13 * s, line, { size: 10.5 * s, fill: t.muted })));
  });
  const slot = framed(c, title, width, rows * cardH + (rows - 1) * gap + 24 * s, body);
  const note = paragraph(c, 0, 0, `${c.l.asAt} ${p.asAt}`, width, { size: 9 * s, maxLines: 1, fill: t.muted });
  const y = headingHeight(c, title) + rows * cardH + (rows - 1) * gap + 24 * s + 4 * s;
  return { svg: `${slot.svg}<g transform="translate(0 ${r(y)})">${note.svg}</g>`, width, height: y + note.height + 12 * s };
}

export function portfolioHealthBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const p = c.portfolio;
  if (!p || p.rows.length === 0) return notReported(c, title, width, 84);
  const { t, s } = c;
  const parts = [
    { band: "ON_TRACK", n: p.totals.onTrack },
    { band: "AT_RISK", n: p.totals.needAttention },
    { band: "OFF_TRACK", n: p.totals.behind },
    { band: "NO_PLAN", n: p.totals.noPlan },
  ].filter((x) => x.n > 0);
  const total = parts.reduce((n, x) => n + x.n, 0) || 1;
  const barW = width - 32 * s;
  let body = "";
  let x = 16 * s;
  for (const part of parts) {
    const w = (part.n / total) * barW;
    body += `<rect x="${r(x)}" y="${r(18 * s)}" width="${r(Math.max(w, 2))}" height="${r(30 * s)}" fill="${bandColor(c, part.band)}"/>`;
    if (w > 28 * s) body += text(c, x + w / 2, 38 * s, String(part.n), { size: 13 * s, bold: true, fill: "#ffffff", anchor: "middle" });
    x += w;
  }
  let y = 74 * s;
  for (const part of parts) {
    body += `<rect x="${r(16 * s)}" y="${r(y - 10 * s)}" width="${r(12 * s)}" height="${r(12 * s)}" fill="${bandColor(c, part.band)}"/>`;
    body += text(c, 34 * s, y, `${bandLabel(c, part.band)}: ${part.n}`, { size: 11.5 * s });
    y += 22 * s;
  }
  return framed(c, title, width, y - 4 * s, body);
}

export function portfolioCountriesBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const p = c.portfolio;
  if (!p || p.countries.length === 0) return notReported(c, title, width, 84);
  const { t, s } = c;
  const shown = p.countries.slice(0, 8);
  const max = Math.max(1, ...shown.map((x) => x.projects));
  const labelW = 120 * s;
  const barMax = Math.max(40, width - labelW - 70 * s);
  let body = "";
  shown.forEach((row, i) => {
    const y = 16 * s + i * 28 * s;
    body += text(c, 16 * s, y + 14 * s, wrapText(row.country, labelW - 24 * s, 11 * s, 1)[0] ?? row.country, { size: 11 * s });
    let x = labelW;
    const seg = [
      { band: "ON_TRACK", n: row.onTrack },
      { band: "AT_RISK", n: row.atRisk },
      { band: "OFF_TRACK", n: row.offTrack },
      { band: "NO_PLAN", n: row.noPlan },
    ];
    for (const part of seg.filter((q) => q.n > 0)) {
      const w = (part.n / max) * barMax;
      body += `<rect x="${r(x)}" y="${r(y + 2 * s)}" width="${r(w)}" height="${r(16 * s)}" fill="${bandColor(c, part.band)}"/>`;
      x += w;
    }
    body += text(c, x + 8 * s, y + 14 * s, String(row.projects), { size: 11 * s, bold: true });
  });
  return framed(c, title, width, 16 * s + shown.length * 28 * s + 8 * s, body);
}

export function portfolioTableBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const p = c.portfolio;
  if (!p || p.rows.length === 0) return notReported(c, title, width, 84);
  const { t, s, l } = c;
  const limit = 14;
  const rows = p.rows.slice(0, limit);
  const col = { name: 16 * s, country: width * 0.38, donor: width * 0.52, health: width * 0.72, next: width - 16 * s };
  let body = "";
  let y = 26 * s;
  const head = (x: number, label: string, anchor?: "end"): void => void (body += text(c, x, y, label, { size: 10 * s, bold: true, fill: t.muted, ...(anchor ? { anchor } : {}) }));
  head(col.name, l.project);
  head(col.country, l.country);
  head(col.donor, l.donor);
  head(col.health, l.health);
  head(col.next, l.nextReport, "end");
  for (const row of rows) {
    y += 28 * s;
    body += text(c, col.name, y, wrapText(row.title, col.country - col.name - 12 * s, 11 * s, 1, true)[0] ?? row.title, { size: 11 * s, bold: true });
    body += text(c, col.country, y, wrapText(row.country, col.donor - col.country - 10 * s, 11 * s, 1)[0] ?? "", { size: 11 * s });
    body += text(c, col.donor, y, wrapText(row.donorName, col.health - col.donor - 10 * s, 11 * s, 1)[0] ?? "", { size: 11 * s, fill: t.body });
    body += `<circle cx="${r(col.health + 5 * s)}" cy="${r(y - 4 * s)}" r="${r(5 * s)}" fill="${bandColor(c, row.band)}"/>`;
    body += text(c, col.health + 16 * s, y, wrapText(bandLabel(c, row.band), col.next - col.health - 130 * s, 11 * s, 1)[0] ?? "", { size: 11 * s });
    const next = row.nextReport ? `${row.nextReport.deadline}${row.nextReport.daysUntil < 0 ? ` · ${Math.abs(row.nextReport.daysUntil)}d ${l.late}` : ""}` : "—";
    body += text(c, col.next, y, next, { size: 11 * s, anchor: "end", fill: row.nextReport && row.nextReport.daysUntil < 0 ? t.signals.LATE : t.body });
    body += `<line x1="${r(12 * s)}" y1="${r(y + 10 * s)}" x2="${r(width - 12 * s)}" y2="${r(y + 10 * s)}" stroke="${t.line}"/>`;
  }
  if (p.rows.length > limit) {
    y += 24 * s;
    body += text(c, 16 * s, y, `+${p.rows.length - limit}`, { size: 10 * s, fill: t.muted });
  }
  return framed(c, title, width, y + 14 * s, body);
}

/** Who does what, where: the author's matrix, columns grouped by the one location normalizer. */
export function threeWBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot | undefined {
  const title = titleFor(c, section);
  const presence = section.presence ?? [];
  if (presence.length === 0) return previewHint(c, title, width, "Add the organizations, what they do and where");
  const { t, s, l } = c;
  // Columns: the places, in the order first named, shown as most often typed.
  const columns = new Map<string, { names: Map<string, number>; count: number }>();
  for (const row of presence) {
    for (const place of row.where) {
      const key = normalizeLocationKey(place) || place.toLowerCase();
      const entry = columns.get(key) ?? { names: new Map<string, number>(), count: 0 };
      entry.names.set(place, (entry.names.get(place) ?? 0) + 1);
      entry.count += 1;
      columns.set(key, entry);
    }
  }
  const places = [...columns.entries()].slice(0, 10).map(([key, v]) => ({ key, name: [...v.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? key, count: v.count }));
  const whoW = Math.min(170 * s, width * 0.24);
  const whatW = Math.min(170 * s, width * 0.24);
  const gridX = 16 * s + whoW + whatW;
  const colW = Math.max(40 * s, (width - gridX - 16 * s) / Math.max(places.length, 1));
  const rowH = 30 * s;
  const headH = 44 * s;
  let body = "";
  body += text(c, 16 * s, 28 * s, l.who, { size: 10 * s, bold: true, fill: t.muted });
  body += text(c, 16 * s + whoW, 28 * s, l.what, { size: 10 * s, bold: true, fill: t.muted });
  places.forEach((place, i) => {
    const cx = gridX + i * colW + colW / 2;
    wrapText(place.name, colW - 6 * s, 9.5 * s, 2, true).forEach((line, li) => (body += text(c, cx, 20 * s + li * 12 * s, line, { size: 9.5 * s, bold: true, fill: t.muted, anchor: "middle" })));
  });
  presence.forEach((row, ri) => {
    const y = headH + ri * rowH;
    if (ri % 2 === 0) body += `<rect x="${r(8 * s)}" y="${r(y - 4 * s)}" width="${r(width - 16 * s)}" height="${r(rowH)}" fill="${t.surface}"/>`;
    body += text(c, 16 * s, y + 15 * s, wrapText(row.who, whoW - 10 * s, 11 * s, 1, true)[0] ?? row.who, { size: 11 * s, bold: true });
    body += text(c, 16 * s + whoW, y + 15 * s, wrapText(row.what, whatW - 10 * s, 10.5 * s, 1)[0] ?? "", { size: 10.5 * s, fill: t.body });
    const keys = new Set(row.where.map((w) => normalizeLocationKey(w) || w.toLowerCase()));
    places.forEach((place, i) => {
      if (keys.has(place.key)) body += `<circle cx="${r(gridX + i * colW + colW / 2)}" cy="${r(y + 11 * s)}" r="${r(6 * s)}" fill="${t.accent}"/>`;
    });
  });
  const totalY = headH + presence.length * rowH + 6 * s;
  body += `<line x1="${r(12 * s)}" y1="${r(totalY - 6 * s)}" x2="${r(width - 12 * s)}" y2="${r(totalY - 6 * s)}" stroke="${t.line}"/>`;
  body += text(c, 16 * s, totalY + 12 * s, `${new Set(presence.map((x) => x.who.toLowerCase())).size} ${l.partnersCount}`, { size: 10 * s, bold: true, fill: t.muted });
  places.forEach((place, i) => (body += text(c, gridX + i * colW + colW / 2, totalY + 12 * s, String(place.count), { size: 10.5 * s, bold: true, anchor: "middle" })));
  const height = totalY + 28 * s;
  const slot = framed(c, title, width, height, body);
  const source = section.caption?.trim();
  if (!source) return slot;
  const note = paragraph(c, 0, 0, `${l.source}: ${source}`, width, { size: 8.5 * s, maxLines: 2, fill: t.muted });
  const y = headingHeight(c, title) + height + 4 * s;
  return { svg: `${slot.svg}<g transform="translate(0 ${r(y)})">${note.svg}</g>`, width, height: y + note.height + 12 * s };
}

void heading;
void textWidth;
