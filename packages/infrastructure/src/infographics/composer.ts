/**
 * The infographic page composer (Phase 31): lays a validated composition onto fixed A4 pages as
 * SVG, from the same data the Studio previews. Deterministic — no clock inside (generatedAt arrives
 * in the provenance), charts come from the shared `buildDataChart` option builders rendered through
 * the same ECharts SSR path as every export, and every officer-typed string is escaped.
 *
 * Missing data renders as "Not yet reported" — never zero, never invented. Sections flow top to
 * bottom; HALF-size sections pair two to a row; a row that does not fit starts a new page. Map pins
 * arrive resolved from the browser — no gazetteer, no geocoding, nothing location-shaped leaves the
 * tenant.
 */
import * as echarts from "echarts";
import sharp from "sharp";
import type { ProjectInfographicDataDto } from "@donordesk/application";
import {
  buildDataChart,
  DEFAULT_SECTION_LABEL,
  provenanceFooter,
  type DataChartSpec,
  type DataSheet,
  type InfographicConfig,
  type InfographicProvenance,
  type InfographicSectionConfig,
} from "@donordesk/domain";

const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN = 72;
const CONTENT_W = PAGE_W - MARGIN * 2;
const GAP = 16;
const USABLE_H = PAGE_H - MARGIN * 2 - 90;
const FONT = "Helvetica, Arial, sans-serif";
const INK = "#111827";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const BLUE = "#2f7be8";
const SOFT = "#eef4fd";
const NOT_REPORTED = "Not yet reported";

const SIGNAL_COLORS: Record<string, string> = {
  ON_TIME: "#16a34a",
  LATE: "#dc2626",
  DONE: "#2563eb",
  CANCELLED: "#94a3b8",
};

const esc = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const widthOf = (size: InfographicSectionConfig["size"] | undefined): number =>
  size === "HALF" ? (CONTENT_W - GAP) / 2 : size === "THIRD" ? (CONTENT_W - GAP * 2) / 3 : CONTENT_W;

interface Slot {
  svg: string;
  height: number;
  width: number;
}

const text = (x: number, y: number, value: string, opts?: { size?: number; fill?: string; bold?: boolean; anchor?: "start" | "middle" | "end" }): string =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${opts?.size ?? 12}" fill="${opts?.fill ?? INK}"${opts?.bold ? ` font-weight="bold"` : ""}${opts?.anchor ? ` text-anchor="${opts.anchor}"` : ""}>${esc(value)}</text>`;

const wrap = (value: string, maxChars: number, maxLines: number): string[] => {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length >= maxLines) return lines;
  }
  if (current) lines.push(current);
  return lines;
};

const sectionTitle = (title: string): string =>
  `<text x="0" y="16" font-family="${FONT}" font-size="15" font-weight="bold" fill="${BLUE}" letter-spacing="1">${esc(title.toUpperCase())}</text>`;

const panel = (y: number, height: number, width: number, fill = "#ffffff", stroke = LINE): string =>
  `<rect x="0" y="${y}" width="${width}" height="${height}" rx="10" fill="${fill}" stroke="${stroke}"/>`;

function notReportedSlot(title: string, width: number, bodyHeight = 72): Slot {
  return {
    width,
    height: 26 + bodyHeight + 18,
    svg: `${sectionTitle(title)}${panel(26, bodyHeight, width)}
      <text x="20" y="${26 + bodyHeight / 2 + 5}" font-family="${FONT}" font-size="13" font-style="italic" fill="#9ca3af">${NOT_REPORTED}</text>`,
  };
}

async function optionToPng(option: Record<string, unknown>, width: number, height: number): Promise<Buffer> {
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
  chart.setOption(option);
  const svg = chart.renderToSVGString();
  chart.dispose();
  return sharp(Buffer.from(svg)).resize(Math.round(width * 1.5), Math.round(height * 1.5)).png().toBuffer();
}

function kpiSlot(data: ProjectInfographicDataDto): Slot {
  const reach = data.reach;
  const planned = data.activities.rows.reduce((total, row) => total + row.planned, 0) + data.activities.unlocated;
  const done = data.activities.rows.reduce((total, row) => total + row.done, 0);
  const financeRow = data.finance.rows[data.finance.rows.length - 1];
  const cards: Array<{ value: string; label: string; detail?: string; tone?: string }> = [
    {
      value: reach.overallUnique === 0 ? NOT_REPORTED : reach.overallUnique.toLocaleString("en-US"),
      label: "People reached (registered, unique)",
      detail: reach.beneficiariesWithoutLocation > 0 ? `${reach.beneficiariesWithoutLocation} without a recorded location` : undefined,
    },
    { value: data.activities.rows.length > 0 ? String(data.activities.rows.length) : NOT_REPORTED, label: "Locations with planned activities" },
    {
      value: planned > 0 ? `${done} / ${planned}` : NOT_REPORTED,
      label: "Activities completed of planned",
      detail: data.activities.unlocated > 0 ? `${data.activities.unlocated} without a location` : undefined,
    },
    financeRow
      ? { value: `Balance ${financeRow.balance}`, label: `Expenditure ${financeRow.expenditure} · ${financeRow.currency}`, detail: financeRow.verified ? undefined : "Not verified yet" }
      : { value: "—", label: "Budget", detail: "Finance not recorded" },
  ];
  const height = 118;
  const cardW = (CONTENT_W - GAP * 3) / 4;
  let svg = sectionTitle("Key figures");
  svg += panel(26, height, CONTENT_W);
  cards.forEach((card, index) => {
    const x = 16 + index * (cardW + GAP);
    svg += `<rect x="${x}" y="40" width="${cardW}" height="${height - 28}" rx="8" fill="#f8fafc"/>`;
    svg += text(x + 12, 70, card.value, { size: card.value.length > 16 ? 15 : 20, bold: true });
    for (const [line, i] of wrap(card.label, 26, 2).map((l, i) => [l, i] as const)) {
      svg += text(x + 12, 90 + i * 13, line, { size: 9.5, fill: MUTED });
    }
    if (card.detail) svg += text(x + 12, height - 6, card.detail, { size: 8.5, fill: "#92400e" });
  });
  return { svg, height: 26 + height + 18, width: CONTENT_W };
}

async function chartSlot(config: InfographicConfig, sheet: DataSheet, section: InfographicSectionConfig, width: number): Promise<Slot> {
  const title = section.title ?? section.chart?.title ?? DEFAULT_SECTION_LABEL.CHART;
  const bodyHeight = 300;
  if (!section.chart) return notReportedSlot(title, width);
  const spec: DataChartSpec = {
    template: section.chart.template,
    indicatorIds: section.chart.indicatorIds,
    measure: section.chart.measure,
    type: section.chart.type,
    fromPeriodId: config.periodFromId,
    toPeriodId: config.periodToId,
    showTarget: section.chart.showTarget ?? false,
  };
  const built = buildDataChart(sheet, spec);
  if (!built.ok) return notReportedSlot(title, width, bodyHeight);
  const png = await optionToPng(built.option, Math.round(width - 16), bodyHeight - 46);
  let svg = sectionTitle(title);
  svg += panel(26, bodyHeight, width);
  svg += `<image x="8" y="34" width="${width - 16}" height="${bodyHeight - 46}" href="${`data:image/png;base64,${png.toString("base64")}`}"/>`;
  built.notes.slice(0, 2).forEach((note: string, index: number) => {
    svg += text(16, 26 + bodyHeight - 6 + index * 11, note, { size: 9, fill: "#92400e" });
  });
  return { svg, height: 26 + bodyHeight + 18, width };
}

function locationResultsSlot(data: ProjectInfographicDataDto, config: InfographicConfig, section: InfographicSectionConfig, width: number): Slot {
  const title = section.title ?? DEFAULT_SECTION_LABEL.LOCATION_RESULTS;
  const named = section.indicatorIds;
  const withTargets = data.indicators.filter((i) => i.targetActual.kind === "WITH_TARGETS" && (!named?.length || named.includes(i.id)));
  const tracked = withTargets.length > 0 ? withTargets : data.indicators.filter((i) => i.location.kind !== "PROJECT_WIDE" && (!named?.length || named.includes(i.id)));
  if (tracked.length === 0) return notReportedSlot(title, width, 84);
  const height = 46 + 30 * 18 + 14;
  let svg = sectionTitle(title);
  svg += panel(26, height, width);
  let row = 56;
  svg += text(16, row, "Location", { size: 10, fill: MUTED, bold: true });
  svg += text(width - 210, row, "Target", { size: 10, fill: MUTED, bold: true, anchor: "end" });
  svg += text(width - 110, row, "Achieved", { size: 10, fill: MUTED, bold: true, anchor: "end" });
  svg += text(width - 16, row, "% of target", { size: 10, fill: MUTED, bold: true, anchor: "end" });
  row += 12;
  const seen = new Set<string>();
  outer: for (const indicator of tracked) {
    if (indicator.targetActual.kind !== "WITH_TARGETS") continue;
    for (const row2 of indicator.targetActual.rows) {
      const cellKey = `${indicator.id}|${row2.key}`;
      if (seen.has(cellKey)) continue;
      if (config.locationKeys?.length && !config.locationKeys.includes(row2.key)) continue;
      seen.add(cellKey);
      row += 27;
      svg += text(16, row, `${indicator.code} ${row2.location}`, { size: 11.5, bold: true });
      svg += text(width - 210, row, row2.target ?? "Not planned", { size: 11.5, anchor: "end", fill: row2.target ? INK : "#9ca3af" });
      svg += text(width - 110, row, row2.actual ?? "Not reported", { size: 11.5, anchor: "end", fill: row2.actual ? INK : "#9ca3af" });
      svg += text(width - 16, row, row2.percentOfTarget ? `${row2.percentOfTarget}%` : "—", { size: 11.5, anchor: "end", fill: row2.percentOfTarget ? INK : "#9ca3af" });
      svg += `<line x1="12" y1="${row + 9}" x2="${width - 12}" y2="${row + 9}" stroke="${LINE}"/>`;
      if (seen.size >= 18 || row > height + 26) break outer;
    }
  }
  return { svg, height: 26 + height + 18, width };
}

function locationComparisonSlot(data: ProjectInfographicDataDto, section: InfographicSectionConfig, width: number): Slot {
  const title = section.title ?? DEFAULT_SECTION_LABEL.LOCATION_COMPARISON;
  const tracked = data.indicators.filter((i) => i.location.kind !== "PROJECT_WIDE").slice(0, 5);
  if (tracked.length === 0) return notReportedSlot(title, width, 84);
  const locations = new Map<string, string>();
  for (const indicator of tracked) {
    if (indicator.location.kind === "PROJECT_WIDE") continue;
    for (const row of indicator.location.rows) locations.set(row.key, row.location);
  }
  const height = 46 + locations.size * 26 + 14;
  let svg = sectionTitle(title);
  svg += panel(26, height, width);
  let column = 160;
  for (const indicator of tracked) {
    svg += text(column, 54, `${indicator.code} ${indicator.name}`.slice(0, 24), { size: 9.5, fill: MUTED, bold: true });
    column += Math.min(200, (width - 160) / tracked.length);
  }
  let row = 72;
  for (const [key, location] of locations) {
    svg += text(16, row, location, { size: 11.5, bold: true });
    let x = 160;
    for (const indicator of tracked) {
      if (indicator.location.kind === "PROJECT_WIDE") continue;
      const cell = indicator.location.rows.find((candidate) => candidate.key === key);
      svg += text(x, row, cell ? cell.value : "—", { size: 11.5, fill: cell ? (cell.verified ? INK : "#92400e") : "#9ca3af" });
      x += Math.min(200, (width - 160) / tracked.length);
    }
    row += 26;
  }
  return { svg, height: 26 + height + 18, width };
}

function reachSlot(data: ProjectInfographicDataDto, section: InfographicSectionConfig, width: number): Slot {
  const title = section.title ?? DEFAULT_SECTION_LABEL.REACH;
  const reach = data.reach;
  if (reach.overallUnique === 0) return notReportedSlot(title, width, 96);
  const height = 150;
  let svg = sectionTitle(title);
  svg += panel(26, height, width);
  svg += text(16, 52, `${reach.overallUnique.toLocaleString("en-US")} unique people`, { size: 16, bold: true });
  svg += text(16, 70, `${reach.registeredTotal.toLocaleString("en-US")} registered in total`, { size: 10, fill: MUTED });
  const max = Math.max(1, ...reach.registeredByLocation.map((row) => row.unique));
  let row = 94;
  for (const location of reach.registeredByLocation.slice(0, 5)) {
    svg += text(16, row + 11, location.location, { size: 10.5 });
    svg += `<rect x="150" y="${row}" width="${(location.unique / max) * (width - 320)}" height="12" rx="6" fill="#8b5cf6"/>`;
    svg += text(width - 160, row + 11, String(location.unique), { size: 10.5 });
    row += 20;
  }
  const attendances = reach.attendancesByActivityLocation.reduce((total, row) => total + row.attendances, 0);
  svg += text(width - 16, 26 + height - 14, `${attendances} attendances (a person may attend several)`, { size: 9.5, fill: MUTED, anchor: "end" });
  return { svg, height: 26 + height + 18, width };
}

function activitiesSlot(data: ProjectInfographicDataDto, section: InfographicSectionConfig, width: number): Slot {
  const title = section.title ?? DEFAULT_SECTION_LABEL.ACTIVITIES_BY_LOCATION;
  if (data.activities.rows.length === 0 && data.activities.unlocated === 0) return notReportedSlot(title, width, 84);
  const shown = data.activities.rows.slice(0, 6);
  const height = 46 + shown.length * 30 + (data.activities.unlocated > 0 ? 20 : 14);
  let svg = sectionTitle(title);
  svg += panel(26, height, width);
  const max = Math.max(1, ...shown.map((row) => row.planned));
  let row = 58;
  for (const location of shown) {
    svg += text(16, row + 12, location.location, { size: 11 });
    svg += `<rect x="200" y="${row}" width="${(location.done / max) * (width - 400)}" height="16" rx="8" fill="${BLUE}"/>`;
    svg += text(width - 16, row + 12, `${location.done} / ${location.planned} done${location.late ? ` · ${location.late} late` : ""}`, { size: 10.5, fill: MUTED, anchor: "end" });
    row += 30;
  }
  if (data.activities.unlocated > 0) {
    svg += text(16, row + 8, `${data.activities.unlocated} activities without a recorded location`, { size: 9.5, fill: "#9ca3af" });
  }
  return { svg, height: 26 + height + 18, width };
}

function mapSlot(mapPoints: MapPointInput[], section: InfographicSectionConfig, width: number): Slot {
  const title = section.title ?? DEFAULT_SECTION_LABEL.MAP;
  const bodyHeight = width >= CONTENT_W ? 260 : 220;
  let svg = sectionTitle(title);
  svg += panel(26, bodyHeight, width, "#eaf2fb", "#d7e4f5");
  if (mapPoints.length === 0) {
    svg += text(width / 2, 26 + bodyHeight / 2, `${NOT_REPORTED} — no placed sites yet`, { size: 12, fill: "#9ca3af", anchor: "middle" });
    return { svg, height: 26 + bodyHeight + 18, width };
  }
  const lats = mapPoints.map((p) => p.lat);
  const lngs = mapPoints.map((p) => p.lng);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const pad = 40;
  const scale = Math.min((width - pad * 2) / Math.max(maxLng - minLng, 0.05), (bodyHeight - pad * 2) / Math.max(maxLat - minLat, 0.05));
  for (const point of mapPoints.slice(0, 120)) {
    const cx = pad + (point.lng - minLng) * scale;
    const cy = bodyHeight - pad - (point.lat - minLat) * scale;
    svg += `<circle cx="${cx}" cy="${cy}" r="${Math.min(6 + (point.count ?? 1), 14)}" fill="${SIGNAL_COLORS[point.worst] ?? BLUE}" stroke="#ffffff" stroke-width="2"/>`;
    svg += text(cx + 10, cy + 4, point.name, { size: 9, fill: "#334155", bold: true });
  }
  svg += text(14, bodyHeight - 12, `${mapPoints.length} site${mapPoints.length === 1 ? "" : "s"}`, { size: 9.5, fill: "#64748b" });
  return { svg, height: 26 + bodyHeight + 18, width };
}

function textSlot(section: InfographicSectionConfig, width: number): Slot {
  const title = section.title ?? DEFAULT_SECTION_LABEL.TEXT;
  const lines = wrap(section.text ?? "", Math.floor((width - 32) / 7.2), 16);
  const height = Math.max(56, 30 + lines.length * 18 + 16);
  let svg = sectionTitle(title);
  svg += panel(26, height, width, "#f8fafc");
  lines.forEach((line, index) => {
    svg += text(16, 56 + index * 18, line, { size: 12.5, fill: "#374151" });
  });
  return { svg, height: 26 + height + 18, width };
}

interface MapPointInput {
  name: string;
  lat: number;
  lng: number;
  worst: string;
  count?: number;
}

export interface InfographicComposeInput {
  config: InfographicConfig;
  data: ProjectInfographicDataDto;
  sheet: DataSheet;
  provenance: InfographicProvenance;
  mapPoints: MapPointInput[];
  organizationName: string;
  logoUrl?: string;
  templateLabel: string;
}

interface Row {
  slots: Slot[];
  height: number;
}

function flowRows(slots: readonly Slot[]): Row[] {
  const rows: Row[] = [];
  let pending: Slot | undefined;
  for (const slot of slots) {
    if (pending) {
      rows.push({ slots: [pending, slot], height: Math.max(pending.height, slot.height) });
      pending = undefined;
      continue;
    }
    if (slot.width < CONTENT_W) {
      pending = slot;
      continue;
    }
    rows.push({ slots: [slot], height: slot.height });
  }
  if (pending) rows.push({ slots: [pending], height: pending.height });
  return rows;
}

/** The rendered pages (SVG strings) of one infographic, ready for sharp (PNG) or pdfkit (PDF). */
export async function composeInfographicPages(input: InfographicComposeInput): Promise<string[]> {
  const config = input.config;
  const slots: Slot[] = [];
  for (const section of config.sections) {
    if (section.hidden) continue;
    const width = widthOf(section.size);
    if (section.kind === "KPIS") slots.push(kpiSlot(input.data));
    else if (section.kind === "CHART") slots.push(await chartSlot(config, input.sheet, section, width));
    else if (section.kind === "LOCATION_RESULTS") slots.push(locationResultsSlot(input.data, config, section, width));
    else if (section.kind === "LOCATION_COMPARISON") slots.push(locationComparisonSlot(input.data, section, width));
    else if (section.kind === "REACH") slots.push(reachSlot(input.data, section, width));
    else if (section.kind === "ACTIVITIES_BY_LOCATION") slots.push(activitiesSlot(input.data, section, width));
    else if (section.kind === "MAP") slots.push(mapSlot(input.mapPoints, section, width));
    else if (section.kind === "TEXT") slots.push(textSlot(section, width));
  }

  const rows = flowRows(slots);
  const pages: Row[][] = [];
  let current: Row[] = [];
  let used = 0;
  for (const row of rows) {
    if (used > 0 && used + row.height > USABLE_H) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += row.height + 8;
  }
  if (current.length > 0) pages.push(current);

  const header = (pages: number, page: number): string => {
    const designTitle = config.title ?? input.templateLabel;
    const periodLabel = input.provenance.periodLabels.length > 0 ? `Reporting period: ${input.provenance.periodLabels.join(" – ")}` : "All periods";
    let out = `<rect x="0" y="0" width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>`;
    if (input.logoUrl?.startsWith("data:image/")) {
      out += `<image x="${MARGIN}" y="${MARGIN - 10}" width="46" height="46" href="${input.logoUrl.slice(0, 600_000)}"/>`;
    }
    const textX = MARGIN + (input.logoUrl?.startsWith("data:image/") ? 58 : 0);
    for (const [line, i] of wrap(input.organizationName, 44, 1).map((l, i) => [l, i] as const)) {
      out += text(textX, MARGIN + 8 + i * 14, line.toUpperCase(), { size: 10, fill: MUTED });
    }
    for (const [line, i] of wrap(designTitle, 44, 2).map((l, i) => [l, i] as const)) {
      out += text(textX, MARGIN + 36 + i * 28, line, { size: 24, bold: true });
    }
    out += `<rect x="${PAGE_W - MARGIN - 220}" y="${MARGIN - 14}" width="220" height="30" rx="15" fill="${SOFT}"/>`;
    out += text(PAGE_W - MARGIN - 110, MARGIN + 6, input.templateLabel, { size: 11, bold: true, fill: BLUE, anchor: "middle" });
    out += text(PAGE_W - MARGIN, MARGIN + 36, periodLabel, { size: 10.5, fill: MUTED, anchor: "end" });
    out += `<rect x="0" y="${MARGIN + 66}" width="${PAGE_W}" height="3" fill="${BLUE}"/>`;
    if (pages > 1) out += text(PAGE_W - MARGIN, PAGE_H - MARGIN - 4, `Page ${page + 1} of ${pages}`, { size: 9.5, fill: MUTED, anchor: "end" });
    return out;
  };

  return pages.map((pageRows, pageIndex) => {
    let y = MARGIN + 96;
    let out = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}">`;
    out += header(pages.length, pageIndex);
    for (const row of pageRows) {
      let x = 0;
      for (const slot of row.slots) {
        out += `<g transform="translate(${MARGIN + x} ${y})">${slot.svg}</g>`;
        x += slot.width + GAP;
      }
      y += row.height + 8;
    }
    const footerY = PAGE_H - MARGIN - 24;
    out += `<rect x="0" y="${footerY}" width="${PAGE_W}" height="1.5" fill="${LINE}"/>`;
    out += text(MARGIN, footerY + 20, provenanceFooter(input.provenance), { size: 10, fill: MUTED });
    out += text(PAGE_W - MARGIN, footerY + 20, "DonorDesk", { size: 10, fill: MUTED, anchor: "end" });
    out += `</svg>`;
    return out;
  });
}

/** One composed page rasterized (used by the PNG renderer). */
export async function rasterizePage(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}
