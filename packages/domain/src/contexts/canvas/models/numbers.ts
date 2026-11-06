/** Big numbers, progress rings and the funnel (Phase 45.1): the figures a card shows, picked once, with "nothing recorded" as `null` - never 0. */
import type { BigNumberItem, BigNumberSource } from "../../infographics/composition.js";
import { parseFigure } from "../../infographics/grounding.js";
import { chosenIndicators, latestById, latestFinance, type CanvasFacts } from "../facts.js";
import { empty, prompt, ready, records, strings, unavailable, NO_FACTS, type SectionProps } from "./props.js";

export interface Figure { amount: number | null; text: string; prefix?: string; suffix?: string; unverified: boolean }
type Pick = (item: BigNumberItem, f: CanvasFacts) => Figure | null;

const plain = (n: number): Figure => ({ amount: n, text: String(n), unverified: false });
const plannedOf = (f: CanvasFacts): number => f.activities.rows.reduce((n, x) => n + x.planned, 0) + f.activities.unlocated;
const doneOf = (f: CanvasFacts): number => f.activities.rows.reduce((n, x) => n + x.done, 0);
const financeFigure = (field: "budget" | "expenditure" | "balance"): Pick => (_i, f) => {
  const row = latestFinance(f);
  if (!row) return null;
  return { amount: parseFigure(row[field]), text: row[field], prefix: row.currency, unverified: !row.verified };
};
const portfolioFigure = (field: keyof NonNullable<CanvasFacts["portfolio"]>["totals"]): Pick => (_i, f) => (f.portfolio && f.portfolio.rows.length > 0 ? plain(f.portfolio.totals[field]) : null);

/** One row per source (exhaustive by type): how each kind of card finds its figure. */
const PICK: Readonly<Record<BigNumberSource, Pick>> = {
  MANUAL: (i) => (i.value?.trim() ? { amount: parseFigure(i.value), text: i.value, unverified: false } : null),
  INDICATOR: (i, f) => {
    const found = i.indicatorId ? latestById(f, i.indicatorId) : undefined;
    if (!found) return null;
    return { amount: found.number, text: found.value, ...(found.unit === "%" ? { suffix: "%" } : found.unit ? { suffix: ` ${found.unit}` } : {}), unverified: !found.verified };
  },
  REACH_UNIQUE: (_i, f) => (f.reach.overallUnique > 0 ? plain(f.reach.overallUnique) : null),
  REACH_REGISTERED: (_i, f) => (f.reach.registeredTotal > 0 ? plain(f.reach.registeredTotal) : null),
  ACTIVITIES_DONE: (_i, f) => (plannedOf(f) > 0 ? plain(doneOf(f)) : null),
  ACTIVITIES_PLANNED: (_i, f) => (plannedOf(f) > 0 ? plain(plannedOf(f)) : null),
  FINANCE_BUDGET: financeFigure("budget"),
  FINANCE_EXPENDITURE: financeFigure("expenditure"),
  FINANCE_BALANCE: financeFigure("balance"),
  PORTFOLIO_PROJECTS: portfolioFigure("projects"),
  PORTFOLIO_COUNTRIES: portfolioFigure("countries"),
  PORTFOLIO_OFF_TRACK: portfolioFigure("behind"),
  PORTFOLIO_AT_RISK: portfolioFigure("needAttention"),
  PORTFOLIO_OPEN_RISKS: portfolioFigure("openRisks"),
  PORTFOLIO_REPORTS_OVERDUE: portfolioFigure("reportsOverdue"),
};

export const bigNumbersModel = (props: SectionProps, facts: CanvasFacts | undefined) => {
  const items = records<BigNumberItem>(props.numbers).filter((i) => i.source in PICK);
  if (items.length === 0) return prompt("Add the figures to show.");
  if (!facts && items.some((i) => i.source !== "MANUAL")) return unavailable(NO_FACTS);
  const cards = items.map((item) => ({ label: typeof item.label === "string" ? item.label : "", source: item.source, ...(item.caption ? { caption: item.caption } : {}), ...(item.iconId ? { iconId: item.iconId } : {}), figure: facts ? PICK[item.source](item, facts) : PICK.MANUAL(item, undefined as never) }));
  const sources = [...new Set(items.filter((x) => x.source === "MANUAL" && x.sourceNote).map((x) => x.sourceNote as string))];
  return ready({ cards, sources, ...(props.rounding ? { rounding: props.rounding } : {}) }, cards.some((c) => c.figure?.unverified) ? ["Some figures are not verified yet."] : []);
};

export const progressRingsModel = (props: SectionProps, facts: CanvasFacts | undefined) => {
  if (!facts) return unavailable(NO_FACTS);
  const picked = chosenIndicators(facts, strings(props.indicatorIds), 6, strings(props.indicatorIds).length === 0);
  if (picked.length === 0) return empty("No indicator has a recorded value yet.");
  return ready({ rings: picked.map((p) => ({ id: p.id, code: p.code, name: p.name, amount: p.number, text: p.value, unit: p.unit ?? "", isRate: p.isRate, percent: p.percent, target: p.targetNumber, verified: p.verified })) }, picked.some((p) => !p.verified) ? ["Some figures are not verified yet."] : []);
};

export const funnelModel = (props: SectionProps, facts: CanvasFacts | undefined) => {
  const stages = records<{ label?: string; value?: number; bind?: string; sourceNote?: string }>(props.stages).map((s) => ({ ...s, label: typeof s.label === "string" ? s.label : "" }));
  if (stages.length === 0) return prompt("Add people in need, targeted and reached.");
  const amounts = stages.map((s) => (s.bind === "REACH_UNIQUE" ? facts?.reach.overallUnique || null : s.bind === "REACH_REGISTERED" ? facts?.reach.registeredTotal || null : s.value ?? null));
  let prev: number | null = null;
  const notes: string[] = [];
  const out = stages.map((s, i) => {
    const amount = amounts[i] ?? null;
    const percentOfPrevious = amount !== null && prev !== null && prev > 0 ? Math.round((amount / prev) * 100) : null;
    if (amount !== null && prev !== null && amount > prev) notes.push(`"${s.label}" is larger than the stage before it.`);
    if (amount !== null) prev = amount;
    return { label: s.label, amount, percentOfPrevious, ...(s.sourceNote ? { sourceNote: s.sourceNote } : {}) };
  });
  return ready({ recorded: amounts.some((a) => a !== null), stages: out, sources: [...new Set(stages.map((s) => s.sourceNote).filter((x): x is string => Boolean(x)))] }, notes);
};

