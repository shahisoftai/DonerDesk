/** Small multiples and the results chain, painted from their models (Phase 45.2). */
import type { ModelOf } from "@donordesk/domain";
import { resultsChainModel, smallMultiplesModel } from "@donordesk/domain";
import { chartSvg } from "../../infographics/blocks-core.js";
import { fmt, framed, mixHex, notReported, onColor, r, text, wrapText } from "../../infographics/kit.js";
import type { PrintPainter } from "../print-types.js";

export const paintSmallMultiples: PrintPainter<ModelOf<typeof smallMultiplesModel>> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 110);
  const { t, s } = c;
  const series = model.model.series;
  const gap = c.grid.gap;
  const perRow = Math.max(1, Math.min(series.length, Math.floor((width + gap) / (260 * s + gap))));
  const tileW = (width - gap * (perRow - 1) - 24 * s) / perRow;
  const tileH = 170 * s;
  const rows = Math.ceil(series.length / perRow);
  let body = "";
  series.forEach((one, i) => {
    const x = 12 * s + (i % perRow) * (tileW + gap);
    const y = 12 * s + Math.floor(i / perRow) * (tileH + gap);
    body += text(c, x + 4 * s, y + 12 * s, wrapText(`${one.code} ${one.name}`, tileW - 8 * s, 10.5 * s, 1, true)[0] ?? one.code, { size: 10.5 * s, bold: true });
    // A gap is `null` and stays a gap in the line.
    const option = {
      animation: false, legend: { show: false }, grid: { left: 40, right: 12, top: 14, bottom: 26 },
      xAxis: { type: "category", data: one.points.map((p) => p.label) },
      yAxis: { type: "value", ...(one.isRate ? {} : { min: 0 }) },
      series: [{ type: "line", data: one.points.map((p) => p.value), connectNulls: false, symbolSize: 5, ...(one.target !== null ? { markLine: { silent: true, symbol: "none", data: [{ yAxis: one.target }] } } : {}) }],
    };
    body += chartSvg(c, option, x, y + 18 * s, Math.round(tileW), Math.round(tileH - 22 * s));
  });
  return framed(c, title, width, rows * (tileH + gap) + 8 * s, body);
};

export const paintResultsChain: PrintPainter<ModelOf<typeof resultsChainModel>> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width, 110);
  const { t, s, l } = c;
  const levelLabel = (level: string): string => c.data.levelWords?.[level] ?? (level === "IMPACT" ? l.impact : level === "GOAL" ? l.goal : level === "OUTCOME" ? l.outcome : level === "OUTPUT" ? l.output : level === "ACTIVITY" ? l.activity : l.indicators);
  let y = 12 * s;
  let body = "";
  const labelW = 120 * s;
  model.model.levels.forEach((group, gi) => {
    const h = Math.max(54 * s, group.rows.length * 30 * s + 16 * s);
    const shade = mixHex(t.accent, "#ffffff", Math.min(0.55, gi * 0.18));
    body += `<path d="M0 ${r(y)} H${r(labelW)} L${r(labelW + 14 * s)} ${r(y + h / 2)} L${r(labelW)} ${r(y + h)} H0 Z" fill="${shade}"/>`;
    body += text(c, 14 * s, y + h / 2 + 5 * s, levelLabel(group.level), { size: 12.5 * s, bold: true, fill: onColor(c, shade) });
    group.rows.forEach((lv, k) => {
      const ry = y + 22 * s + k * 30 * s;
      body += text(c, labelW + 30 * s, ry, wrapText(`${lv.code} ${lv.name}`, width - labelW - 190 * s, 11 * s, 1)[0] ?? lv.code, { size: 11 * s });
      body += text(c, width - 16 * s, ry, `${lv.number !== null ? fmt(c, lv.number) : lv.value}${lv.unit === "%" ? "%" : ""}${lv.percent !== null && lv.targetNumber !== null ? ` / ${fmt(c, lv.targetNumber)} · ${Math.round(lv.percent)}%` : ""}`, { size: 11 * s, bold: true, anchor: "end", fill: lv.verified ? t.ink : t.warn });
    });
    y += h + 8 * s;
  });
  return framed(c, title, width, y + 4 * s, body);
};
