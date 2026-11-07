/** Small multiples and the results chain (Phase 45.2): one picture per indicator over time, and the indicators grouped by logframe level. A missing value is a gap (`null`), never 0. */
import { chosenIndicators, designPeriods, type CanvasFacts, type LatestValue } from "../facts.js";
import { parseFigure } from "../../infographics/grounding.js";
import { empty, ready, strings, unavailable, NO_FACTS, type SectionProps } from "./props.js";

export interface MultipleSeries { id: string; code: string; name: string; isRate: boolean; target: number | null; points: Array<{ periodId: string; label: string; value: number | null; verified: boolean }> }
const MAX_MULTIPLES = 6;
const DEFAULT_MULTIPLES = 4;

export const smallMultiplesModel = (props: SectionProps, facts: CanvasFacts | undefined) => {
  if (!facts) return unavailable(NO_FACTS);
  const periods = designPeriods(facts);
  const named = strings(props.indicatorIds);
  const cellOf = (indicatorId: string, periodId: string) => facts.sheet.cells.find((x) => x.indicatorId === indicatorId && x.periodId === periodId);
  const series = (facts.sheet.indicators.filter((i) => (named.length > 0 ? named.includes(i.id) : true)).map((i): MultipleSeries => ({
    id: i.id, code: i.code, name: i.name, isRate: i.isRate, target: parseFigure(i.target),
    points: periods.map((periodId) => {
      const cell = cellOf(i.id, periodId);
      const raw = !cell ? "" : !i.isRate && cell.cumulativeValue.trim() !== "" ? cell.cumulativeValue : cell.periodValue;
      return { periodId, label: facts.sheet.periods.find((p) => p.id === periodId)?.label ?? periodId, value: raw.trim() === "" ? null : parseFigure(raw), verified: cell?.status === "VERIFIED" };
    }),
  })));
  const shown = named.length > 0 ? series.slice(0, MAX_MULTIPLES) : series.filter((s) => s.points.filter((p) => p.value !== null).length >= 2).slice(0, DEFAULT_MULTIPLES);
  if (shown.length === 0) return empty("No indicator has two recorded periods yet.");
  return ready({ series: shown }, shown.some((s) => s.points.some((p) => p.value !== null && !p.verified)) ? ["Some points are not verified yet."] : []);
};

const LEVEL_ORDER = ["IMPACT", "GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"] as const;
const PER_LEVEL = 4;
export interface ChainLevel { level: string; rows: LatestValue[]; more: number }

export const resultsChainModel = (_props: SectionProps, facts: CanvasFacts | undefined) => {
  if (!facts) return unavailable(NO_FACTS);
  const all = chosenIndicators(facts, undefined, Number.MAX_SAFE_INTEGER);
  const groups = new Map<string, LatestValue[]>();
  for (const lv of all) groups.set((lv.level ?? "OTHER").toUpperCase(), [...(groups.get((lv.level ?? "OTHER").toUpperCase()) ?? []), lv]);
  const rank = (l: string): number => { const i = (LEVEL_ORDER as readonly string[]).indexOf(l); return i < 0 ? 99 : i; };
  const levels: ChainLevel[] = [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b)).map(([level, list]) => ({ level, rows: list.slice(0, PER_LEVEL), more: Math.max(0, list.length - PER_LEVEL) }));
  if (levels.length === 0) return empty("No indicator has a recorded value yet.");
  return ready({ levels }, all.some((x) => !x.verified) ? ["Some figures are not verified yet."] : []);
};
