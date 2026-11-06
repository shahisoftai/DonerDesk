/** Who we reached and the money, painted from their models (Phase 45.2). */
import type { ModelOf } from "@donordesk/domain";
import { demographicsModel, fundingModel } from "@donordesk/domain";
import { fmt, framed, notReported, r, text, textWidth, wrapText } from "../../infographics/kit.js";
import type { RenderCtx } from "../../infographics/kit.js";
import type { PrintPainter } from "../print-types.js";

type Demographics = ModelOf<typeof demographicsModel>;

const sexName = (c: RenderCtx, s: Demographics["sex"][number]): string =>
  s.kind === "FEMALE" ? c.l.female : s.kind === "MALE" ? c.l.male : s.kind === "OTHER" ? c.l.other : s.kind === "UNKNOWN" ? c.l.unknown : s.key;

function ageName(c: RenderCtx, a: Demographics["ages"][number]): string {
  const g = a.group;
  if (g.kind === "UNDER_5") return c.l.ageUnder5;
  if (g.kind === "60_PLUS") return c.l.age60Plus;
  if (g.kind === "RANGE") return `${g.from}–${g.to}`;
  if (g.kind === "OPEN") return `${g.from}+`;
  if (g.kind === "UNKNOWN") return c.l.unknown;
  return g.text;
}

export const paintDemographics: PrintPainter<Demographics> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 100);
  const { sex, ages, sexTotal: total } = model.model;
  const { t, s } = c;
  let body = "";
  let y = 24 * s;
  if (sex.length > 0) {
    body += text(c, 16 * s, y, c.l.sex, { size: 10 * s, bold: true, fill: t.muted });
    y += 12 * s;
    const barW = width - 32 * s;
    let x = 16 * s;
    const colors = [t.accent, t.accent2, t.palette[2] ?? t.accent, t.palette[3] ?? t.muted];
    sex.forEach((g, i) => {
      const w = (g.count / total) * barW;
      body += `<rect x="${r(x)}" y="${r(y)}" width="${r(Math.max(w, 2))}" height="${r(22 * s)}" fill="${colors[i % colors.length]}"/>`;
      x += w;
    });
    y += 22 * s + 16 * s;
    let lx = 16 * s;
    sex.forEach((g, i) => {
      const label = `${sexName(c, g)} ${fmt(c, g.count)} (${g.percent}%)`;
      body += `<rect x="${r(lx)}" y="${r(y - 9 * s)}" width="${r(10 * s)}" height="${r(10 * s)}" fill="${colors[i % colors.length]}"/>`;
      body += text(c, lx + 15 * s, y, label, { size: 10.5 * s });
      lx += textWidth(label, 10.5 * s) + 38 * s;
      if (lx > width - 120 * s && i < sex.length - 1) { lx = 16 * s; y += 16 * s; }
    });
    y += 26 * s;
  }
  if (ages.length > 0) {
    body += text(c, 16 * s, y, c.l.ageGroup, { size: 10 * s, bold: true, fill: t.muted });
    y += 8 * s;
    const max = Math.max(...ages.map((a) => a.count));
    const labelW = 74 * s;
    const barMax = Math.max(40, width - labelW - 90 * s);
    ages.forEach((a) => {
      y += 20 * s;
      body += text(c, 16 * s, y + 10 * s, ageName(c, a), { size: 10.5 * s });
      body += `<rect x="${r(16 * s + labelW)}" y="${r(y)}" width="${r(Math.max(2, (a.count / max) * barMax))}" height="${r(13 * s)}" rx="${r(3 * s)}" fill="${t.accent}"/>`;
      body += text(c, 16 * s + labelW + (a.count / max) * barMax + 8 * s, y + 10.5 * s, fmt(c, a.count), { size: 10.5 * s });
    });
    y += 24 * s;
  }
  return framed(c, title, width, y, body);
};

type Funding = ModelOf<typeof fundingModel>;
export const paintFunding: PrintPainter<Funding> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 84);
  const shown = model.model.rows;
  const { t, s } = c;
  const max = Math.max(1, ...shown.map((x) => x.budget ?? 0));
  const barX = 150 * s;
  const barMax = Math.max(60, width - barX - 150 * s);
  let body = "";
  let y = 18 * s;
  shown.forEach((row) => {
    body += text(c, 16 * s, y + 14 * s, wrapText(row.period, barX - 24 * s, 11 * s, 1, true)[0] ?? "", { size: 11 * s, bold: true });
    if (row.budget !== null) body += `<rect x="${r(barX)}" y="${r(y)}" width="${r(Math.max(2, (row.budget / max) * barMax))}" height="${r(10 * s)}" rx="${r(5 * s)}" fill="${t.accentSoft}" stroke="${t.cardStroke}"/>`;
    if (row.expenditure !== null) body += `<rect x="${r(barX)}" y="${r(y + 14 * s)}" width="${r(Math.max(2, (row.expenditure / max) * barMax))}" height="${r(10 * s)}" rx="${r(5 * s)}" fill="${row.verified ? t.accent : t.subtle}"/>`;
    body += text(c, width - 16 * s, y + 10 * s, `${c.l.budget} ${row.currency} ${row.budget !== null ? fmt(c, row.budget) : row.budgetText}`, { size: 10 * s, fill: t.muted, anchor: "end" });
    body += text(c, width - 16 * s, y + 24 * s, `${c.l.expenditure} ${row.expenditure !== null ? fmt(c, row.expenditure) : row.expenditureText}${row.burnRatePercent ? ` · ${row.burnRatePercent}%` : ""}${row.verified ? "" : ` · ${c.l.notVerifiedYet}`}`, { size: 10 * s, fill: row.verified ? t.ink : t.warn, anchor: "end" });
    y += 40 * s;
  });
  return framed(c, title, width, y + 6 * s, body);
};
