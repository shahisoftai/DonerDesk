/**
 * A share-of-whole picture of one indicator's recorded split (Phase 34.5): a pie of the groups of one dimension for one period.
 * A pie says "parts of a whole", so it is drawn only when the parts add up: a count or an amount (never a rate or a ratio), at least
 * two groups, every group above zero. Anything else is refused with a sentence, not drawn badly.
 */
import type { DatasetResult } from "./dataset-query.js";

export type BreakdownChart = { ok: true; option: Record<string, unknown>; title: string; alt: string; notes: string[] } | { ok: false; reason: string };

export function breakdownPie(data: DatasetResult, indicatorId: string, dimension?: string): BreakdownChart {
  const indicator = data.indicators.find((i) => i.id === indicatorId);
  if (!indicator) return { ok: false, reason: "The indicator is not in this project." };
  if (indicator.isRate || !["NUMBER", "CURRENCY"].includes(indicator.type)) return { ok: false, reason: "Groups of a rate or a ratio do not add up to a whole, so they are not drawn as a pie." };
  const point = [...data.points].reverse().find((p) => p.indicatorId === indicatorId && p.breakdown?.length);
  if (!point?.breakdown) return { ok: false, reason: "No split by group has been recorded for this indicator." };
  const chosen = dimension ?? point.breakdown[0]!.dimension;
  const parts = point.breakdown.filter((e) => e.dimension === chosen).map((e) => ({ name: e.category, value: Number(e.value.replace(/,/g, "")) }));
  if (parts.some((p) => !Number.isFinite(p.value))) return { ok: false, reason: "Some groups are not numbers, so they cannot be drawn." };
  if (parts.length < 2) return { ok: false, reason: "A pie needs at least two groups." };
  if (parts.some((p) => p.value <= 0)) return { ok: false, reason: "A group with no people or amount cannot be drawn as a slice." };
  const total = parts.reduce((s, p) => s + p.value, 0);
  const notes = [`Groups are for ${point.periodLabel}.`];
  if (!point.verified) notes.push("This split is not verified yet.");
  const alt = `${indicator.code} ${indicator.name} in ${point.periodLabel}, by group: ${parts.map((p) => `${p.name} ${Math.round((p.value / total) * 1000) / 10}%`).join(", ")}.`;
  return {
    ok: true, title: `${indicator.code} ${indicator.name}`, notes, alt,
    option: { aria: { enabled: true, label: { description: alt } }, tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" }, legend: { bottom: 0 }, series: [{ type: "pie", radius: ["35%", "65%"], data: parts, label: { formatter: "{b}\n{d}%" } }] },
  };
}
