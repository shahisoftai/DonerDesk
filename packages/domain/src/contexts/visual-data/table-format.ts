/**
 * The professional table (Phase 48.12): number formats, conditional formatting (colour scale, thresholds, icon sets, in-cell bars),
 * sort, search, paging and a totals row, all as pure functions from a `VisualTable` and a style. A gap is always "Not measured"
 * (never 0), a colour is never the only signal (thresholds carry an icon and a word), a total adds only what can be added and says
 * when it left a gap out, and a rate is never summed.
 */
import type { Cell, ColumnInfo, VisualTable } from "./shape.js";

export const TABLE_NUMBER_FORMATS = ["AUTO", "INTEGER", "DECIMAL1", "DECIMAL2", "PERCENT", "COMPACT", "CURRENCY"] as const;
export type TableNumberFormat = (typeof TABLE_NUMBER_FORMATS)[number];
export const TABLE_NOT_MEASURED = "Not measured";
export const NO_TOTAL = "—";

export function formatCell(value: Cell, format: TableNumberFormat, options: { locale?: string; currency?: string } = {}): string {
  if (value === null || value === undefined) return TABLE_NOT_MEASURED;
  if (typeof value === "string") return value;
  const locale = options.locale === "ar" ? "ar-u-nu-latn" : (options.locale ?? "en");
  const nf = (o: Intl.NumberFormatOptions): string => new Intl.NumberFormat(locale, o).format(value);
  switch (format) {
    case "INTEGER": return nf({ maximumFractionDigits: 0 });
    case "DECIMAL1": return nf({ minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case "DECIMAL2": return nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "PERCENT": return `${nf({ maximumFractionDigits: 1 })}%`;
    case "COMPACT": return nf({ notation: "compact", maximumFractionDigits: 1 });
    case "CURRENCY": return options.currency ? nf({ style: "currency", currency: options.currency }) : nf({ maximumFractionDigits: 2 });
    default: return Number.isInteger(value) ? nf({ maximumFractionDigits: 0 }) : nf({ maximumFractionDigits: 2 });
  }
}

export const TONES = ["GOOD", "WARN", "BAD", "NEUTRAL"] as const;
export type Tone = (typeof TONES)[number];
/** The icon and word that go with every tone, so a colour is never alone. */
export const TONE_MARK: Readonly<Record<Tone, { icon: string; word: string }>> = { GOOD: { icon: "▲", word: "On track" }, WARN: { icon: "■", word: "Watch" }, BAD: { icon: "▼", word: "Behind" }, NEUTRAL: { icon: "●", word: "" } };

export type CellRule =
  | { kind: "COLOUR_SCALE"; column: string; from?: string; to?: string }
  | { kind: "THRESHOLD"; column: string; /** Value at or above `good` is GOOD, at or above `warn` is WARN, otherwise BAD; `higherIsBetter` false reverses it. */ good: number; warn: number; higherIsBetter?: boolean }
  | { kind: "DATA_BAR"; column: string }
  | { kind: "ICON_SET"; column: string; breaks: [number, number] };

export interface ColumnStyle { id: string; label?: string; width?: number; align?: "start" | "center" | "end"; wrap?: boolean; format?: TableNumberFormat; hidden?: boolean }

export interface TableStyle {
  columns?: ColumnStyle[];
  rules?: CellRule[];
  stickyHeader?: boolean;
  stickyFirstColumn?: boolean;
  sort?: { column: string; direction: "ASC" | "DESC" };
  search?: string;
  pageSize?: number;
  page?: number;
  /** Columns to total. Only additive columns are summed; others show a dash. */
  totals?: string[];
  currency?: string;
  locale?: string;
}

export interface RenderedCell { raw: Cell; text: string; tone?: Tone; mark?: { icon: string; word: string }; background?: string; bar?: number; notMeasured: boolean }
export interface RenderedTable {
  columns: Array<ColumnInfo & { width?: number; align: "start" | "center" | "end"; wrap: boolean }>;
  rows: RenderedCell[][];
  totals?: Array<{ text: string; partial: boolean } | null>;
  page: { index: number; size: number; pages: number; rows: number; matching: number };
  notes: string[];
  sticky: { header: boolean; firstColumn: boolean };
}

const MAX_PAGE = 500;
const numeric = (c: Cell | undefined): number | null => (typeof c === "number" && Number.isFinite(c) ? c : null);

function scaleColour(t: number, from: string, to: string): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(from), b = p(to);
  return `#${a.map((v, i) => Math.round(v + (b[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

function sorted(rows: ReadonlyArray<Record<string, Cell>>, sort: TableStyle["sort"]): Array<Record<string, Cell>> {
  const copy = [...rows];
  if (!sort) return copy;
  const dir = sort.direction === "ASC" ? 1 : -1;
  // A gap is last whichever way the column is sorted: "not measured" is never the biggest or the smallest.
  return copy.sort((a, b) => {
    const x = a[sort.column] ?? null, y = b[sort.column] ?? null;
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
  });
}

export function renderTable(table: VisualTable, style: TableStyle = {}): RenderedTable {
  const notes = [...table.notes];
  const byStyle = new Map((style.columns ?? []).map((c) => [c.id, c]));
  const shown = table.columns.filter((c) => !byStyle.get(c.id)?.hidden);
  const columns = shown.map((c) => ({ ...c, label: byStyle.get(c.id)?.label ?? c.label, ...(byStyle.get(c.id)?.width ? { width: byStyle.get(c.id)!.width } : {}), align: byStyle.get(c.id)?.align ?? (c.role === "DIMENSION" ? "start" as const : "end" as const), wrap: byStyle.get(c.id)?.wrap ?? false }));

  const wanted = (style.search ?? "").trim().toLowerCase();
  const matching = wanted ? table.rows.filter((r) => shown.some((c) => String(r[c.id] ?? "").toLowerCase().includes(wanted))) : table.rows;
  const ordered = sorted(matching, style.sort);
  const size = Math.min(MAX_PAGE, Math.max(1, Math.round(style.pageSize ?? (ordered.length || 1))));
  const pages = Math.max(1, Math.ceil(ordered.length / size));
  const index = Math.min(pages - 1, Math.max(0, Math.round(style.page ?? 0)));
  const visible = ordered.slice(index * size, index * size + size);

  // Rules read the whole matching set, not just the page, so a colour means the same on every page.
  const stats = new Map<string, { min: number; max: number }>();
  for (const rule of style.rules ?? []) {
    const values = ordered.map((r) => numeric(r[rule.column])).filter((v): v is number => v !== null);
    if (values.length > 0) stats.set(rule.column, { min: Math.min(...values), max: Math.max(...values) });
    if ((rule.kind === "DATA_BAR") && values.some((v) => v < 0)) notes.push("In-cell bars are not drawn for a column with negative values.");
  }

  const fmtFor = (c: ColumnInfo): TableNumberFormat => byStyle.get(c.id)?.format ?? (c.type === "RATE" ? "PERCENT" : "AUTO");
  const rows = visible.map((row) => shown.map((c): RenderedCell => {
    const raw = row[c.id] ?? null;
    const cell: RenderedCell = { raw, text: formatCell(raw, fmtFor(c), { locale: style.locale ?? "en", ...(style.currency ? { currency: style.currency } : {}) }), notMeasured: raw === null };
    const v = numeric(raw);
    if (v === null) return cell;
    for (const rule of (style.rules ?? []).filter((r) => r.column === c.id)) {
      const s = stats.get(c.id);
      if (rule.kind === "COLOUR_SCALE" && s) cell.background = s.max === s.min ? scaleColour(0.5, rule.from ?? "#e0f2fe", rule.to ?? "#0369a1") : scaleColour((v - s.min) / (s.max - s.min), rule.from ?? "#e0f2fe", rule.to ?? "#0369a1");
      else if (rule.kind === "DATA_BAR" && s && s.min >= 0 && s.max > 0) cell.bar = Math.round((v / s.max) * 1000) / 1000;
      else if (rule.kind === "THRESHOLD") {
        const up = rule.higherIsBetter !== false;
        const tone: Tone = up ? (v >= rule.good ? "GOOD" : v >= rule.warn ? "WARN" : "BAD") : (v <= rule.good ? "GOOD" : v <= rule.warn ? "WARN" : "BAD");
        cell.tone = tone; cell.mark = TONE_MARK[tone];
      } else if (rule.kind === "ICON_SET") { const tone: Tone = v >= rule.breaks[1] ? "GOOD" : v >= rule.breaks[0] ? "WARN" : "BAD"; cell.tone = tone; cell.mark = TONE_MARK[tone]; }
    }
    return cell;
  }));

  let totals: RenderedTable["totals"];
  if (style.totals && style.totals.length > 0) {
    totals = shown.map((c) => {
      if (!style.totals!.includes(c.id)) return null;
      // A rate or an average is never added up; a dash says so.
      if (c.type === "RATE" || c.role === "DIMENSION") return { text: NO_TOTAL, partial: false };
      const present = ordered.map((r) => numeric(r[c.id])).filter((v): v is number => v !== null);
      if (present.length === 0) return { text: TABLE_NOT_MEASURED, partial: false };
      const partial = present.length < ordered.length;
      if (partial) notes.push(`The total of ${c.label} adds only the rows that have a figure; rows with nothing recorded are left out, never counted as 0.`);
      return { text: formatCell(Math.round(present.reduce((a, b) => a + b, 0) * 1e6) / 1e6, fmtFor(c), { locale: style.locale ?? "en", ...(style.currency ? { currency: style.currency } : {}) }), partial };
    });
  }
  return { columns, rows, ...(totals ? { totals } : {}), page: { index, size, pages, rows: visible.length, matching: ordered.length }, notes: [...new Set(notes)], sticky: { header: style.stickyHeader ?? true, firstColumn: style.stickyFirstColumn ?? false } };
}

export function tableStyleProblems(style: TableStyle, columnIds: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  const known = new Set(columnIds);
  for (const c of style.columns ?? []) if (!known.has(c.id)) out.push(`The style names a column that is not in the table (${c.id}).`);
  for (const r of style.rules ?? []) {
    if (!known.has(r.column)) out.push(`A rule names a column that is not in the table (${r.column}).`);
    if (r.kind === "THRESHOLD" && (r.higherIsBetter === false ? r.good > r.warn : r.good < r.warn)) out.push("A threshold's good value must be on the better side of its watch value.");
    if (r.kind === "ICON_SET" && r.breaks[0] > r.breaks[1]) out.push("An icon set's first break must not be above its second.");
  }
  if (style.sort && !known.has(style.sort.column)) out.push("The table is sorted by a column that is not in it.");
  for (const t of style.totals ?? []) if (!known.has(t)) out.push(`A total names a column that is not in the table (${t}).`);
  if (style.pageSize !== undefined && (!Number.isInteger(style.pageSize) || style.pageSize < 1 || style.pageSize > MAX_PAGE)) out.push(`A page shows between 1 and ${MAX_PAGE} rows.`);
  return out;
}

/** The table as CSV text for what is shown (all matching rows, not just the page); a leading = + - @ is defused. */
export function tableCsv(table: VisualTable, style: TableStyle = {}): string {
  const r = renderTable(table, { ...style, pageSize: MAX_PAGE, page: 0 });
  const esc = (s: string): string => { const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };
  return [r.columns.map((c) => esc(c.label)).join(","), ...r.rows.map((row) => row.map((c) => esc(c.notMeasured ? "" : c.text)).join(","))].join("\n");
}
