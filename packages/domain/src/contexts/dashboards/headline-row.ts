/**
 * The headline row (Phase 39.6): the first thing a dashboard made from a template shows is a row of up to four KPI tiles for the
 * template's own roles, so the one-line answer comes before the charts. Pure: it only decides which indicators and where; the
 * handler makes the widgets. A role nobody mapped gets no tile (never a placeholder), and an indicator is never shown twice.
 */
import type { IndicatorRole } from "./dashboard-templates.js";
import { GRID_COLUMNS, MAX_WIDGETS } from "./dashboard.js";

export const HEADLINE_MAX = 4;
export const HEADLINE_HEIGHT = 3;

export interface HeadlinePick { roleKey: string; indicatorId: string; x: number; w: number }

/** Required roles first, then the others, each in the template's own order; only those that were mapped. */
export function headlinePicks(roles: ReadonlyArray<IndicatorRole>, mapping: Readonly<Record<string, string | null | undefined>>, existingWidgets: number): HeadlinePick[] {
  const room = Math.max(0, Math.min(HEADLINE_MAX, MAX_WIDGETS - existingWidgets));
  const seen = new Set<string>();
  const chosen: Array<{ roleKey: string; indicatorId: string }> = [];
  for (const r of [...roles.filter((x) => x.required), ...roles.filter((x) => !x.required)]) {
    const id = mapping[r.key];
    if (!id || seen.has(id) || chosen.length >= room) continue;
    seen.add(id);
    chosen.push({ roleKey: r.key, indicatorId: id });
  }
  if (chosen.length === 0) return [];
  const w = Math.floor(GRID_COLUMNS / chosen.length);
  return chosen.map((c, i) => ({ ...c, x: i * w, w: i === chosen.length - 1 ? GRID_COLUMNS - w * i : w }));
}
