import type { Norm } from "./chart-render.js";
import type { KindBuilt, RenderKit } from "./chart-render-kinds.js";
import type { ChartSpecV2 } from "./chart-spec-v2.js";

/**
 * Phase 48.15: a bar race. The chart as stored and drawn in a file is the latest period that has figures (an ordinary ranked bar); the
 * option also carries every period's frame (`raceFrames`) so a screen can step through them. A frame ranks only the indicators that
 * have a figure that period: a gap is left out of that frame, never drawn as a bar of 0, and the period's name is on every frame.
 */
export interface RaceFrame { label: string; names: string[]; values: number[] }
const MAX_BARS = 10;

export function barRace(spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  if (norm.series.length < 2) return "A bar race ranks indicators against each other: choose at least two of the same kind.";
  if (norm.categories.length < 3) return "A bar race needs at least three periods.";
  const limit = Math.min(MAX_BARS, Math.max(2, spec.dataset.topN ?? MAX_BARS));
  const frames: RaceFrame[] = norm.categories.map((label, c) => {
    const ranked = norm.series.map((s) => ({ name: s.name, v: s.data[c] ?? null })).filter((x): x is { name: string; v: number } => x.v !== null).sort((a, b) => b.v - a.v || a.name.localeCompare(b.name)).slice(0, limit);
    return { label, names: ranked.map((r) => r.name), values: ranked.map((r) => r.v) };
  });
  const withFigures = frames.filter((f) => f.values.length > 0);
  if (withFigures.length < 2) return "A bar race needs figures in at least two periods.";
  const last = withFigures.at(-1)!;
  const max = Math.max(...withFigures.flatMap((f) => f.values));
  return {
    option: {
      ...kit.base(false), tooltip: { trigger: "axis", axisPointer: { type: "shadow" } }, grid: { left: 24, right: 56, top: 56, bottom: 24, containLabel: true },
      xAxis: { type: "value", max, axisLabel: { show: true } }, yAxis: { type: "category", inverse: true, data: last.names, animationDuration: 300, animationDurationUpdate: 300 },
      series: [{ type: "bar", realtimeSort: false, data: last.values, itemStyle: { color: kit.palette[0] }, label: { show: true, position: "right", valueAnimation: true } }],
      animationDuration: 0, animationDurationUpdate: 900, animationEasing: "linear", animationEasingUpdate: "linear",
      raceFrames: frames,
    },
    notes: [`The chart shows ${last.label}, the latest period with figures; Play steps through every period, naming each. An indicator with no figure in a period is left out of that period, never drawn as zero. Every bar uses the same scale.`],
  };
}
