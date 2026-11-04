/** Marks one period on a chart that has periods along its bottom axis (a dashed vertical line), so a map beside it and the chart agree on "when". Pure. */
type Option = Record<string, unknown>;

const labelOf = (d: unknown): string | null => (typeof d === "string" ? d : typeof d === "object" && d !== null && typeof (d as { value?: unknown }).value === "string" ? (d as { value: string }).value : null);

/** The chart with a dashed line at `label`, or the chart as it was when it has no such period on a category axis. Never changes its input. */
export function highlightPeriod(option: Option, label: string | null): Option {
  if (!label) return option;
  const axis = Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis;
  const data = (axis as { data?: unknown } | undefined)?.data;
  if (!Array.isArray(data) || !data.some((d) => labelOf(d) === label)) return option;
  const series = option.series;
  if (!Array.isArray(series) || series.length === 0) return option;
  const [first, ...rest] = series as Option[];
  const existing = (first!.markLine ?? {}) as { data?: unknown[] };
  const line = {
    ...existing, silent: true, symbol: "none",
    lineStyle: { type: "dashed", width: 1.5, color: "#64748b" },
    label: { show: true, position: "insideEndTop", formatter: label },
    data: [...(existing.data ?? []), { xAxis: label }],
  };
  return { ...option, series: [{ ...first, markLine: line }, ...rest] };
}
