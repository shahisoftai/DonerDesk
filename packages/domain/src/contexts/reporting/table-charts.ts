import type { ChartType, DerivedChartBinding, ResolvedChartData } from "./chart-config.js";

/**
 * Charts derived from the TABLES of a report section.
 *
 * A chart is never drawn from "the project's indicators" in general: it visualises one table the reader can see in the same section,
 * so the two cannot disagree and a section with several tables gets a chart for each table that has something to show. The tables
 * are read from the section's final text (GFM markdown), which is where the verified indicator table, the finance table and the
 * activity participant table all end up, whoever produced them and however the text was edited afterwards.
 */

export interface MarkdownTable {
  /** 0-based position among the tables of the section. */
  index: number;
  header: string[];
  rows: string[][];
  /** A short line directly above the table that names it (a heading or a line ending in ":"). */
  caption?: string;
}

export type TableKind = "INDICATORS" | "FINANCE" | "ACTIVITY_PARTICIPANTS" | "OTHER";

export interface TableChart {
  binding: DerivedChartBinding;
  type: ChartType;
  title: string;
  caption: string;
  unit?: string;
  categories: string[];
  series: Array<{ name: string; data: Array<number | null> }>;
  stacked?: boolean;
  referenceLine?: { name: string; value: number };
  truncated?: { shown: number; total: number };
  /** The table this chart visualises. */
  tableIndex: number;
  tableCaption?: string;
}

const MAX_CATEGORIES = 12;

const SEPARATOR_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const ROW_RE = /^\s*\|.*\|\s*$/;

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (ch === "\\" && inner[i + 1] === "|") {
      current += "|";
      i++;
    } else if (ch === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Every GFM table in a section's markdown, in reading order. */
export function parseMarkdownTables(content: string): MarkdownTable[] {
  const lines = content.split(/\r?\n/);
  const tables: MarkdownTable[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!ROW_RE.test(lines[i]!) || !SEPARATOR_RE.test(lines[i + 1]!)) continue;
    const header = splitRow(lines[i]!);
    const rows: string[][] = [];
    let j = i + 2;
    while (j < lines.length && ROW_RE.test(lines[j]!)) {
      rows.push(splitRow(lines[j]!));
      j++;
    }
    let caption: string | undefined;
    for (let k = i - 1; k >= 0; k--) {
      const prev = lines[k]!.trim();
      if (!prev) continue;
      if (!ROW_RE.test(prev) && prev.length <= 140 && (/^#{1,6}\s/.test(prev) || prev.endsWith(":"))) caption = prev.replace(/^#{1,6}\s+/, "").replace(/:$/, "").replace(/\*\*/g, "").trim();
      break;
    }
    tables.push({ index: tables.length, header, rows, ...(caption ? { caption } : {}) });
    i = j - 1;
  }
  return tables;
}

const clean = (cell: string | undefined): string => (cell ?? "").replace(/\*\*|__|`/g, "").trim();
const norm = (cell: string | undefined): string => clean(cell).toLowerCase();

/** "1,260", "105%", "USD 3,000", "12.5 %" → number; "—", "Not calculable", "n/a", "" → null. */
export function parseTableNumber(cell: string | undefined): number | null {
  const text = clean(cell).replace(/,/g, "");
  if (!text || /^(—|-|–|n\/a|na|not calculable|none)$/i.test(text)) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(text);
  if (!m) return null;
  const n = Number.parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

const findCol = (header: string[], test: (h: string) => boolean): number => header.findIndex((h) => test(norm(h)));

export function classifyTable(table: MarkdownTable): TableKind {
  const h = table.header.map(norm);
  const has = (re: RegExp): boolean => h.some((x) => re.test(x));
  if (has(/^code$/) && (has(/% of (project )?target/) || (has(/^target$/) && has(/this period|achievement|cumulative|actual/)))) return "INDICATORS";
  if (has(/budget line|^line$|budget item|category/) && has(/^budget/) && has(/expenditure|spent|actual/)) return "FINANCE";
  if (has(/^activity|activities/) && has(/^total$|participants/) && has(/^total$|^male$|^female$|participants/)) return "ACTIVITY_PARTICIPANTS";
  return "OTHER";
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

function indicatorChart(t: MarkdownTable): Omit<TableChart, "tableIndex" | "tableCaption" | "caption"> | null {
  const codeCol = findCol(t.header, (h) => h === "code");
  const nameCol = findCol(t.header, (h) => h === "indicator" || h === "name");
  const lifePct = findCol(t.header, (h) => /% of project target/.test(h));
  const periodPct = findCol(t.header, (h) => /^% of target/.test(h));
  const targetCol = findCol(t.header, (h) => h === "target");
  const valueCol = findCol(t.header, (h) => /^cumulative|this period|achievement|actual/.test(h));
  // The to-date percentage when the table has one, then the table's own percentage, then value / target.
  const pctOf = (row: string[]): number | null => {
    const stated = lifePct >= 0 ? parseTableNumber(row[lifePct]) : periodPct >= 0 ? parseTableNumber(row[periodPct]) : null;
    if (stated !== null) return stated;
    // A row whose percentage is blank is computed from its own value and target, so one gap does not drop an indicator.
    const target = parseTableNumber(row[targetCol]);
    const value = parseTableNumber(row[valueCol]);
    return target && target > 0 && value !== null ? round1((value / target) * 100) : null;
  };
  const basis = lifePct >= 0 ? "to date, % of project target" : "% of target";
  const points = t.rows
    .map((r) => ({ label: clean(r[codeCol]) || clean(r[nameCol]), value: pctOf(r) }))
    .filter((p): p is { label: string; value: number } => p.label !== "" && p.value !== null);
  if (points.length < 2) return null;
  const shown = points.slice(0, MAX_CATEGORIES);
  return {
    binding: "TABLE_INDICATOR_PROGRESS",
    type: "BAR",
    title: lifePct >= 0 ? "Progress to date against project targets" : "Progress against targets",
    unit: "%",
    categories: shown.map((p) => p.label),
    series: [{ name: basis, data: shown.map((p) => p.value) }],
    referenceLine: { name: "Target (100%)", value: 100 },
    ...(points.length > shown.length ? { truncated: { shown: shown.length, total: points.length } } : {}),
  };
}

function financeChart(t: MarkdownTable): Omit<TableChart, "tableIndex" | "tableCaption" | "caption"> | null {
  const labelCol = findCol(t.header, (h) => /budget line|^line$|budget item|category/.test(h));
  const budgetCol = findCol(t.header, (h) => /^budget(?! line| item)/.test(h));
  const spentCol = findCol(t.header, (h) => /expenditure|spent|actual/.test(h));
  const unit = /\(([A-Za-z]{3})\)/.exec(clean(t.header[budgetCol]))?.[1]?.toUpperCase();
  const all = t.rows.map((r) => ({ label: clean(r[labelCol]), budget: parseTableNumber(r[budgetCol]), spent: parseTableNumber(r[spentCol]) })).filter((r) => r.label && (r.budget !== null || r.spent !== null));
  const lines = all.filter((r) => !/^total\b/i.test(r.label));
  const rows = lines.length > 0 ? lines : all;
  if (rows.length === 0) return null;
  const shown = rows.slice(0, MAX_CATEGORIES);
  return {
    binding: "TABLE_FINANCE_BY_LINE",
    type: "BAR",
    title: "Budget and expenditure by budget line",
    ...(unit ? { unit } : {}),
    categories: shown.map((r) => r.label),
    series: [
      { name: "Budget", data: shown.map((r) => r.budget) },
      { name: "Expenditure", data: shown.map((r) => r.spent) },
    ],
    ...(rows.length > shown.length ? { truncated: { shown: shown.length, total: rows.length } } : {}),
  };
}

function activityChart(t: MarkdownTable): Omit<TableChart, "tableIndex" | "tableCaption" | "caption"> | null {
  const labelCol = findCol(t.header, (h) => /^activity|activities/.test(h));
  const totalCol = findCol(t.header, (h) => h === "total" || /participants/.test(h));
  const maleCol = findCol(t.header, (h) => h === "male");
  const femaleCol = findCol(t.header, (h) => h === "female");
  const rows = t.rows.map((r) => ({
    label: clean(r[labelCol]).slice(0, 48),
    total: parseTableNumber(r[totalCol]),
    male: parseTableNumber(r[maleCol]),
    female: parseTableNumber(r[femaleCol]),
  })).filter((r) => r.label && !/^total\b/i.test(r.label));
  const split = rows.filter((r) => r.male !== null && r.female !== null);
  if (split.length >= 2) {
    const shown = split.slice(0, MAX_CATEGORIES);
    return {
      binding: "TABLE_ACTIVITY_PARTICIPANTS",
      type: "BAR",
      title: "Participants by activity",
      unit: "participants",
      categories: shown.map((r) => r.label),
      series: [
        { name: "Female", data: shown.map((r) => r.female) },
        { name: "Male", data: shown.map((r) => r.male) },
      ],
      stacked: true,
      ...(split.length > shown.length ? { truncated: { shown: shown.length, total: split.length } } : {}),
    };
  }
  const totals = rows.filter((r) => r.total !== null);
  if (totals.length < 2) return null;
  const shown = totals.slice(0, MAX_CATEGORIES);
  return {
    binding: "TABLE_ACTIVITY_PARTICIPANTS",
    type: "BAR",
    title: "Participants by activity",
    unit: "participants",
    categories: shown.map((r) => r.label),
    series: [{ name: "Participants", data: shown.map((r) => r.total) }],
    ...(totals.length > shown.length ? { truncated: { shown: shown.length, total: totals.length } } : {}),
  };
}

const ANNEX_TITLE_RE = /\b(annex|appendix|attachment)\b/i;

/**
 * The charts of one section: one per table that has a chart to give, each tied to its table. Annexes (reference listings of what
 * the report body already charts) get none, and two tables that would draw the same chart give one.
 */
export function chartsForSection(section: { title: string; content: string }): TableChart[] {
  if (ANNEX_TITLE_RE.test(section.title)) return [];
  const charts: TableChart[] = [];
  const seen = new Set<string>();
  for (const table of parseMarkdownTables(section.content)) {
    const kind = classifyTable(table);
    const built = kind === "INDICATORS" ? indicatorChart(table) : kind === "FINANCE" ? financeChart(table) : kind === "ACTIVITY_PARTICIPANTS" ? activityChart(table) : null;
    if (!built) continue;
    const fingerprint = JSON.stringify([built.binding, built.categories, built.series]);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    const tableCaption = table.caption;
    charts.push({
      ...built,
      caption: tableCaption ? `${built.title} — ${tableCaption}` : charts.length === 0 ? built.title : `${built.title} (table ${table.index + 1})`,
      tableIndex: table.index,
      ...(tableCaption ? { tableCaption } : {}),
    });
  }
  return charts;
}

/** The chart as the resolved dataset the renderers (browser and export) draw. */
export function tableChartToResolved(chart: TableChart): ResolvedChartData {
  return {
    type: chart.type,
    dataBinding: chart.binding,
    categories: chart.categories,
    series: chart.series,
    ...(chart.unit ? { unit: chart.unit } : {}),
    title: chart.title,
    ...(chart.stacked ? { stacked: true } : {}),
    ...(chart.referenceLine ? { referenceLine: chart.referenceLine } : {}),
    ...(chart.truncated ? { truncated: chart.truncated } : {}),
  };
}
