/**
 * The Phase 31 blocks, drawn on the Phase 32 context (theme, grid, language, scale). Same data,
 * same "Not yet reported" rule; the figures a block shows are exactly what the Studio's data read
 * holds. Each function returns a Slot, or undefined when the block has nothing to show in an export.
 */
import * as echarts from "echarts";
import { buildDataChart, DEFAULT_SECTION_LABEL, SECTION_LABEL_KEY, fill, type DataChartSpec, type InfographicSectionConfig } from "@donordesk/domain";
import { flipBack, fmt, framed, heading, headingHeight, notReported, panelRect, paragraph, r, text, textWidth, wrapText, type RenderCtx, type Slot } from "./kit.js";
import { chosenIndicators, latestFinance } from "./facts.js";

/** The heading a section shows: authored, else the (translated) default label. */
export function titleFor(c: RenderCtx, section: InfographicSectionConfig): string | undefined {
  if (section.title) return section.title;
  const key = SECTION_LABEL_KEY[section.kind];
  return key ? c.l[key] : undefined;
}

/**
 * Gives a chart option the theme's colours: the series' own colours are dropped so the palette applies,
 * and the reference line takes the theme's warning colour. Everything else is the shared chart engine's.
 */
export function themedOption(c: RenderCtx, option: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(option)) as Record<string, unknown>;
  const series = clone.series;
  if (Array.isArray(series)) {
    for (const item of series as Array<Record<string, unknown>>) {
      for (const key of ["itemStyle", "lineStyle", "areaStyle"] as const) {
        const style = item[key] as Record<string, unknown> | undefined;
        if (style && typeof style === "object") delete style.color;
      }
      const mark = item.markLine as { lineStyle?: { color?: string } } | undefined;
      if (mark?.lineStyle) mark.lineStyle.color = c.t.warn;
    }
  }
  // Axes, grid lines, legends and titles take the theme's colours too, so a greyscale theme draws a greyscale chart.
  const axis = (a: unknown): unknown =>
    Array.isArray(a)
      ? a.map(axis)
      : a && typeof a === "object"
        ? { ...(a as Record<string, unknown>), axisLine: { lineStyle: { color: c.t.line } }, axisTick: { lineStyle: { color: c.t.line } }, axisLabel: { ...((a as { axisLabel?: object }).axisLabel ?? {}), color: c.t.muted }, splitLine: { lineStyle: { color: c.t.line } }, nameTextStyle: { color: c.t.muted } }
        : a;
  const out: Record<string, unknown> = { ...clone, color: [...c.t.palette], textStyle: { fontFamily: c.font, color: c.t.body } };
  if (clone.xAxis !== undefined) out.xAxis = axis(clone.xAxis);
  if (clone.yAxis !== undefined) out.yAxis = axis(clone.yAxis);
  if (clone.legend && typeof clone.legend === "object") out.legend = { ...(clone.legend as object), textStyle: { color: c.t.body } };
  if (clone.title && typeof clone.title === "object") out.title = { ...(clone.title as object), textStyle: { color: c.t.ink } };
  return out;
}

/**
 * A chart as a vector picture nested in the page: the shared chart engine draws it to SVG, and the page carries it as it is,
 * so a PDF keeps the chart's text and lines as vector content and a preview stays small. Animation is off (a still picture).
 */
export function chartSvg(c: RenderCtx, option: Record<string, unknown>, x: number, y: number, width: number, height: number): string {
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
  chart.setOption({ ...themedOption(c, option), animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();
  // The engine's own <svg> root becomes a nested <svg> placed on the page; its drawing is untouched.
  const prefix = `ch${(c.chartSeq += 1)}-`;
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/\s+class="[^"]*"/g, "")
    .replace(/zr\d+-/g, prefix);
  return flipBack(c, x + width / 2, `<svg x="${r(x)}" y="${r(y)}" width="${r(width)}" height="${r(height)}" viewBox="0 0 ${width} ${height}">${inner}</svg>`);
}

export function kpiBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const { data, l, t, s } = c;
  const reach = data.reach;
  const planned = data.activities.rows.reduce((total, row) => total + row.planned, 0) + data.activities.unlocated;
  const done = data.activities.rows.reduce((total, row) => total + row.done, 0);
  const financeRow = data.finance.rows[data.finance.rows.length - 1];
  const cards: Array<{ value: string; label: string; detail?: string }> = [
    {
      value: reach.overallUnique === 0 ? l.notYetReported : fmt(c, reach.overallUnique),
      label: l.peopleReachedRegisteredUnique,
      ...(reach.beneficiariesWithoutLocation > 0 ? { detail: `${fmt(c, reach.beneficiariesWithoutLocation)} ${l.withoutRecordedLocation}` } : {}),
    },
    { value: data.activities.rows.length > 0 ? String(data.activities.rows.length) : l.notYetReported, label: l.locationsWithPlanned },
    {
      value: planned > 0 ? `${done} / ${planned}` : l.notYetReported,
      label: l.activitiesCompletedOfPlanned,
      ...(data.activities.unlocated > 0 ? { detail: `${data.activities.unlocated} ${l.withoutALocation}` } : {}),
    },
    financeRow
      ? { value: `${l.balance} ${financeRow.balance}`, label: `${l.expenditure} ${financeRow.expenditure} · ${financeRow.currency}`, ...(financeRow.verified ? {} : { detail: l.notVerifiedYet }) }
      : { value: "—", label: l.budget, detail: l.financeNotRecorded },
  ];
  const height = 118 * s;
  const gap = c.grid.gap;
  const cardW = (width - 32 * s - gap * 3) / 4;
  let body = "";
  cards.forEach((card, index) => {
    const x = 16 * s + index * (cardW + gap);
    body += `<rect x="${r(x)}" y="${r(14 * s)}" width="${r(cardW)}" height="${r(height - 28 * s)}" rx="${r(Math.min(8, t.radius))}" fill="${t.surface}"/>`;
    body += text(c, x + 12 * s, 44 * s, card.value, { size: (card.value.length > 16 ? 15 : 20) * s, bold: true });
    wrapText(card.label, cardW - 24 * s, 9.5 * s, 2).forEach((line, i) => (body += text(c, x + 12 * s, 64 * s + i * 13 * s, line, { size: 9.5 * s, fill: t.muted })));
    if (card.detail) body += text(c, x + 12 * s, height - 20 * s, card.detail, { size: 8.5 * s, fill: t.warn });
  });
  return framed(c, titleFor(c, section), width, height, body);
}

export async function chartBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Promise<Slot> {
  const title = section.title ?? section.chart?.title ?? c.l.chart;
  const bodyHeight = 300 * c.s;
  if (!section.chart) return notReported(c, title, width);
  const spec: DataChartSpec = {
    template: section.chart.template,
    indicatorIds: section.chart.indicatorIds,
    measure: section.chart.measure,
    type: section.chart.type,
    fromPeriodId: c.config.periodFromId,
    toPeriodId: c.config.periodToId,
    showTarget: section.chart.showTarget ?? false,
  };
  const built = buildDataChart(c.sheet, spec);
  if (!built.ok) return notReported(c, title, width, 300);
  let body = chartSvg(c, built.option, 8, 8 * c.s, Math.round(width - 16), Math.round(bodyHeight - 46 * c.s));
  built.notes.slice(0, 2).forEach((note: string, index: number) => {
    body += text(c, 16, bodyHeight - 6 * c.s - (1 - index) * 11 * c.s, note, { size: 9 * c.s, fill: c.t.warn });
  });
  return framed(c, title, width, bodyHeight, body);
}

export function locationResultsBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const { data, config, l, t, s } = c;
  const named = section.indicatorIds;
  const withTargets = data.indicators.filter((i) => i.targetActual.kind === "WITH_TARGETS" && (!named?.length || named.includes(i.id)));
  const tracked = withTargets.length > 0 ? withTargets : data.indicators.filter((i) => i.location.kind !== "PROJECT_WIDE" && (!named?.length || named.includes(i.id)));
  if (tracked.length === 0) return notReported(c, title, width, 84);
  const keys = section.locationKeys?.length ? section.locationKeys : config.locationKeys;
  const lineH = 27 * s;
  let body = "";
  let row = 30 * s;
  body += text(c, 16 * s, row, l.location, { size: 10 * s, fill: t.muted, bold: true });
  body += text(c, width - 210 * s, row, l.target, { size: 10 * s, fill: t.muted, bold: true, anchor: "end" });
  body += text(c, width - 110 * s, row, l.achieved, { size: 10 * s, fill: t.muted, bold: true, anchor: "end" });
  body += text(c, width - 16 * s, row, l.percentOfTarget, { size: 10 * s, fill: t.muted, bold: true, anchor: "end" });
  const seen = new Set<string>();
  const line = (label: string, target: string | undefined, actual: string | undefined, pct: string | undefined, actualFill: string): void => {
    row += lineH;
    body += text(c, 16 * s, row, wrapText(label, width - 300 * s, 11.5 * s, 1, true)[0] ?? label, { size: 11.5 * s, bold: true });
    body += text(c, width - 210 * s, row, target ?? l.notPlanned, { size: 11.5 * s, anchor: "end", fill: target ? t.ink : t.subtle });
    body += text(c, width - 110 * s, row, actual ?? l.notReported, { size: 11.5 * s, anchor: "end", fill: actual ? actualFill : t.subtle });
    body += text(c, width - 16 * s, row, pct ? `${pct}%` : "—", { size: 11.5 * s, anchor: "end", fill: pct ? t.ink : t.subtle });
    body += `<line x1="${r(12 * s)}" y1="${r(row + 9 * s)}" x2="${r(width - 12 * s)}" y2="${r(row + 9 * s)}" stroke="${t.line}"/>`;
  };
  outer: for (const indicator of tracked) {
    if (indicator.targetActual.kind === "WITH_TARGETS") {
      for (const x of indicator.targetActual.rows) {
        const key = `${indicator.id}|${x.key}`;
        if (seen.has(key) || (keys?.length && !keys.includes(x.key))) continue;
        seen.add(key);
        line(`${indicator.code} ${x.location}`, x.target, x.actual ?? undefined, x.percentOfTarget, t.ink);
        if (seen.size >= 18) break outer;
      }
    } else if (indicator.location.kind !== "PROJECT_WIDE") {
      for (const x of indicator.location.rows) {
        const key = `${indicator.id}|${x.key}`;
        if (seen.has(key) || (keys?.length && !keys.includes(x.key))) continue;
        seen.add(key);
        line(`${indicator.code} ${x.location}`, undefined, x.value, undefined, x.verified ? t.ink : t.warn);
        if (seen.size >= 18) break outer;
      }
    }
  }
  return framed(c, title, width, row - 6 * s + 24 * s, body);
}

export function locationComparisonBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const { data, t, s } = c;
  const tracked = data.indicators.filter((i) => i.location.kind !== "PROJECT_WIDE").slice(0, 5);
  if (tracked.length === 0) return notReported(c, title, width, 84);
  const locations = new Map<string, string>();
  for (const indicator of tracked) {
    if (indicator.location.kind === "PROJECT_WIDE") continue;
    for (const x of indicator.location.rows) locations.set(x.key, x.location);
  }
  const first = 160 * s;
  const colW = Math.min(200 * s, (width - first) / tracked.length);
  let body = "";
  tracked.forEach((indicator, i) => {
    body += text(c, first + i * colW, 28 * s, wrapText(`${indicator.code} ${indicator.name}`, colW - 8 * s, 9.5 * s, 1, true)[0] ?? indicator.code, { size: 9.5 * s, fill: t.muted, bold: true });
  });
  let row = 46 * s;
  for (const [key, location] of locations) {
    body += text(c, 16 * s, row, wrapText(location, first - 24 * s, 11.5 * s, 1, true)[0] ?? location, { size: 11.5 * s, bold: true });
    tracked.forEach((indicator, i) => {
      if (indicator.location.kind === "PROJECT_WIDE") return;
      const cell = indicator.location.rows.find((x) => x.key === key);
      body += text(c, first + i * colW, row, cell ? cell.value : "—", { size: 11.5 * s, fill: cell ? (cell.verified ? t.ink : t.warn) : t.subtle });
    });
    row += 26 * s;
  }
  return framed(c, title, width, row - 8 * s + 12 * s, body);
}

export function reachBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const { data, l, t, s } = c;
  const reach = data.reach;
  if (reach.overallUnique === 0) return notReported(c, title, width, 96);
  const rows = reach.registeredByLocation.slice(0, 5);
  const height = (74 + rows.length * 20 + 34) * s;
  let body = text(c, 16 * s, 28 * s, `${fmt(c, reach.overallUnique)} ${l.uniquePeople}`, { size: 16 * s, bold: true });
  body += text(c, 16 * s, 46 * s, `${fmt(c, reach.registeredTotal)} ${l.registeredInTotal}`, { size: 10 * s, fill: t.muted });
  const max = Math.max(1, ...rows.map((x) => x.unique));
  const barX = 150 * s;
  const barMax = Math.max(40, width - barX - 90 * s);
  rows.forEach((x, i) => {
    const y = (70 + i * 20) * s;
    body += text(c, 16 * s, y + 11 * s, wrapText(x.location, barX - 24 * s, 10.5 * s, 1)[0] ?? x.location, { size: 10.5 * s });
    body += `<rect x="${r(barX)}" y="${r(y)}" width="${r((x.unique / max) * barMax)}" height="${r(12 * s)}" rx="${r(6 * s)}" fill="${t.accent2}"/>`;
    body += text(c, barX + (x.unique / max) * barMax + 8 * s, y + 11 * s, fmt(c, x.unique), { size: 10.5 * s });
  });
  const attendances = reach.attendancesByActivityLocation.reduce((total, x) => total + x.attendances, 0);
  body += text(c, width - 16 * s, height - 12 * s, `${fmt(c, attendances)} ${l.attendancesNote}`, { size: 9.5 * s, fill: t.muted, anchor: "end" });
  return framed(c, title, width, height, body);
}

export function activitiesBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const { data, l, t, s } = c;
  if (data.activities.rows.length === 0 && data.activities.unlocated === 0) return notReported(c, title, width, 84);
  const shown = data.activities.rows.slice(0, 6);
  const height = (30 + shown.length * 30 + (data.activities.unlocated > 0 ? 28 : 14)) * s;
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
  if (data.activities.unlocated > 0) body += text(c, 16 * s, height - 10 * s, `${data.activities.unlocated} ${l.activitiesWithoutLocation}`, { size: 9.5 * s, fill: t.subtle });
  return framed(c, title, width, height, body);
}

export function textBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const size = 12.5 * c.s;
  const para = paragraph(c, 16 * c.s, 14 * c.s, section.text ?? "", width - 32 * c.s, { size, maxLines: 16, fill: c.t.body, lineHeight: size * 1.45 });
  const height = Math.max(56 * c.s, 30 * c.s + para.height);
  return framed(c, title, width, height, para.svg, c.t.surface);
}

export { headingHeight, heading, panelRect, fill, textWidth, latestFinance, chosenIndicators };
