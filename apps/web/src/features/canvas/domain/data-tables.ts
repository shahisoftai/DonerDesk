import { optionToTable } from "@donordesk/domain/contexts/reporting/chart-screen.js";

/** A table of what a canvas shows: a gap is an empty cell here (the file says "Not measured" only where the screen does), never 0. */
export interface DataTable { name: string; columns: string[]; rows: Array<Array<string | number | null>> }

interface DrawingLike {
  chart?: { option: Record<string, unknown>; title: string } | undefined;
  table?: { title: string; columns: string[]; rows: Array<Array<string | null>> } | undefined;
  kpi?: { title: string; unit: string | null; value: number | null; periodLabel: string | null; target: string | null; percentOfTarget: number | null } | undefined;
}

const MAX_TABLES = 30;
const MAX_ROWS = 5000;

/** Every picture that is a table of values, in the order given; a map or timeline is not a table and is left out. Names are made unique. */
export function tablesOfDrawings(drawings: ReadonlyArray<DrawingLike>): DataTable[] {
  const out: DataTable[] = [];
  const kpis: DataTable = { name: "Key figures", columns: ["Figure", "Value", "Unit", "Period", "Target", "% of target"], rows: [] };
  for (const d of drawings) {
    if (d.table) out.push({ name: d.table.title || "Table", columns: d.table.columns, rows: d.table.rows.slice(0, MAX_ROWS) });
    else if (d.chart) {
      const t = optionToTable(d.chart.option);
      if (t) out.push({ name: d.chart.title || "Chart", columns: t.columns, rows: t.rows.slice(0, MAX_ROWS) });
    } else if (d.kpi) kpis.rows.push([d.kpi.title, d.kpi.value, d.kpi.unit, d.kpi.periodLabel, d.kpi.target, d.kpi.percentOfTarget]);
  }
  if (kpis.rows.length > 0) out.unshift(kpis);
  const used = new Map<string, number>();
  return out.slice(0, MAX_TABLES).map((t) => {
    const n = (used.get(t.name) ?? 0) + 1;
    used.set(t.name, n);
    return n === 1 ? t : { ...t, name: `${t.name} (${n})` };
  });
}

/** A cell that a spreadsheet would read as a formula is written as text, so a typed word can never run. */
const safe = (v: string | number | null): string => {
  if (v === null) return "";
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
};
const quote = (s: string): string => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** All the tables in one CSV, each under its own name line and separated by a blank line. */
export function tablesCsv(tables: ReadonlyArray<DataTable>): string {
  return tables.map((t) => [quote(safe(t.name)), t.columns.map((c) => quote(safe(c))).join(","), ...t.rows.map((r) => r.map((c) => quote(safe(c))).join(","))].join("\n")).join("\n\n");
}
