import type { ColumnInfo } from "../../visual-data/shape.js";
import { referenceLabel } from "../../visual-data/references.js";
import type { DataVisualModel } from "./data-visual.js";

/**
 * The picture of a dataset visual as an ECharts option (Phase 54), pure, so the screen and a file draw the same thing. A gap is drawn as a
 * gap ("-"), never 0; a bar axis starts at zero; a rate carries "%"; reference lines are drawn with their source label; values chosen by
 * the viewer's slicer are emphasised, the others dimmed. Tables, cards and maps are drawn by their own components from the same model.
 */
export interface OptionTheme { palette: readonly string[]; text: string; muted: string; grid: string; good: string; bad: string }

const unitOf = (c: ColumnInfo | undefined): string => (c?.type === "RATE" ? "%" : c?.unit ? ` ${c.unit}` : "");
const num = (v: unknown): number | "-" => (typeof v === "number" && Number.isFinite(v) ? v : "-");
const label = (v: unknown): string => (v === null || v === undefined || v === "" ? "Not stated" : String(v));

export function dataVisualOption(model: DataVisualModel, theme: OptionTheme, selected: readonly string[] = []): Record<string, unknown> {
  const cols = new Map(model.table.columns.map((c) => [c.id, c]));
  const axis = model.table.columns.find((c) => c.role === "DIMENSION" && c.id !== model.legend);
  const rows = model.table.rows;
  const dim = (on: string): number => (selected.length && !selected.includes(on) ? 0.25 : 1);
  const base = { color: [...theme.palette], textStyle: { color: theme.text }, aria: { enabled: true }, animationDuration: 300 };

  if (model.family === "PIE") {
    const m = model.drawn[0];
    const data = axis && m
      ? rows.map((r) => ({ name: label(r[axis.id]), value: num(r[m]), itemStyle: { opacity: dim(label(r[axis.id])) } })).filter((d) => d.value !== "-")
      : model.drawn.map((id) => ({ name: cols.get(id)?.label ?? id, value: num(rows[0]?.[id]), itemStyle: { opacity: 1 } })).filter((d) => d.value !== "-");
    return { ...base, tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" }, legend: { bottom: 0, type: "scroll", textStyle: { color: theme.muted } }, series: [{ type: "pie", radius: ["38%", "68%"], data, label: { color: theme.text } }] };
  }

  const categories = axis ? [...new Set(rows.map((r) => label(r[axis.id])))] : [""];
  const line = model.family === "LINE" || model.family === "AREA";
  const stacked = model.family === "STACKED_BAR" || model.family === "AREA";
  type S = { name: string; values: Array<number | "-">; unit: string };
  let series: S[];
  if (model.legend && model.drawn.length === 1) {
    const m = model.drawn[0]!;
    const groups = [...new Set(rows.map((r) => label(r[model.legend!])))];
    series = groups.map((g) => ({ name: g, unit: unitOf(cols.get(m)), values: categories.map((c) => { const hit = rows.find((r) => label(r[axis?.id ?? ""]) === c && label(r[model.legend!]) === g); return hit ? num(hit[m]) : "-"; }) }));
  } else {
    series = model.drawn.map((m) => ({ name: cols.get(m)?.label ?? m, unit: unitOf(cols.get(m)), values: categories.map((c) => { const hit = rows.find((r) => (axis ? label(r[axis.id]) : "") === c); return hit ? num(hit[m]) : "-"; }) }));
  }
  const refs = model.references;
  const markLine = refs.some((r) => r.kind === "LINE") ? { symbol: "none", silent: true, lineStyle: { type: "dashed", width: 2 }, label: { formatter: "{b}", position: "insideEndTop", color: theme.text }, data: refs.filter((r) => r.kind === "LINE").map((r) => ({ name: referenceLabel(r), yAxis: r.value, lineStyle: { color: r.role === "AT_LEAST" ? theme.good : r.role === "AT_MOST" ? theme.bad : theme.muted } })) } : undefined;
  const markArea = refs.some((r) => r.kind === "BAND") ? { silent: true, itemStyle: { opacity: 0.12 }, data: refs.filter((r) => r.kind === "BAND").map((r) => [{ name: referenceLabel(r), yAxis: r.from }, { yAxis: r.to }]) } : undefined;
  const unit = series[0]?.unit ?? "";
  return {
    ...base,
    grid: { left: 8, right: 16, top: refs.length ? 28 : 16, bottom: series.length > 1 ? 36 : 8, containLabel: true },
    tooltip: { trigger: "axis", valueFormatter: unit === "%" ? "{value} %" : undefined },
    legend: series.length > 1 ? { bottom: 0, type: "scroll", textStyle: { color: theme.muted } } : undefined,
    xAxis: { type: "category", data: categories, axisLabel: { color: theme.muted, hideOverlap: true, interval: categories.length > 20 ? "auto" : 0, rotate: categories.length > 8 && !line ? 30 : 0 }, axisLine: { lineStyle: { color: theme.grid } } },
    yAxis: { type: "value", min: line ? undefined : 0, axisLabel: { color: theme.muted, formatter: unit === "%" ? "{value} %" : "{value}" }, splitLine: { lineStyle: { color: theme.grid } } },
    series: series.map((s, i) => ({
      type: line ? "line" : "bar", name: s.name, data: s.values.map((v, k) => (v === "-" ? v : { value: v, itemStyle: { opacity: dim(categories[k]!) } })),
      ...(stacked ? { stack: "total" } : {}), ...(model.family === "AREA" ? { areaStyle: { opacity: 0.25 } } : {}), ...(line ? { connectNulls: false, symbolSize: 6 } : { barMaxWidth: 48 }),
      ...(i === 0 && markLine ? { markLine } : {}), ...(i === 0 && markArea ? { markArea } : {}),
    })),
  };
}
