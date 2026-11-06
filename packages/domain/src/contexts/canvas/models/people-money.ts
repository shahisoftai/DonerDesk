/** Who we reached and the money (Phase 45.1): breakdowns with a total they add to, finance rows with their verification. */
import { parseFigure } from "../../infographics/grounding.js";
import { ageGroupKind, designPeriods, sexKind, sortedAgeGroups } from "../facts.js";
import type { CanvasFacts } from "../facts.js";
import { empty, ready, unavailable, NO_FACTS, type SectionProps } from "./props.js";

const MAX_AGE_GROUPS = 8;
const MAX_FINANCE_ROWS = 6;

export const demographicsModel = (_props: SectionProps, facts: CanvasFacts | undefined) => {
  if (!facts) return unavailable(NO_FACTS);
  const sexEntries = Object.entries(facts.reach.bySex).filter(([, n]) => n > 0);
  const ageEntries = sortedAgeGroups(Object.entries(facts.reach.byAgeGroup).filter(([, n]) => n > 0));
  if (sexEntries.length === 0 && ageEntries.length === 0) return empty("No beneficiaries are registered by sex or age yet.");
  const total = sexEntries.reduce((n, [, v]) => n + v, 0);
  return ready({
    sexTotal: total,
    sex: sexEntries.map(([key, count]) => ({ key, kind: sexKind(key), count, percent: Math.round((count / total) * 100) })),
    ages: ageEntries.slice(0, MAX_AGE_GROUPS).map(([key, count]) => ({ key, group: ageGroupKind(key), count })),
  }, ageEntries.length > MAX_AGE_GROUPS ? [`Showing the first ${MAX_AGE_GROUPS} of ${ageEntries.length} age groups.`] : []);
};

export const fundingModel = (_props: SectionProps, facts: CanvasFacts | undefined) => {
  if (!facts) return unavailable(NO_FACTS);
  if (!facts.finance.enabled || facts.finance.rows.length === 0) return empty("Finance is not recorded for this project.");
  const inRange = new Set(designPeriods(facts));
  const rows = facts.finance.rows.filter((r) => inRange.has(r.periodId)).slice(-MAX_FINANCE_ROWS);
  const shown = rows.length > 0 ? rows : facts.finance.rows.slice(-MAX_FINANCE_ROWS);
  const label = (id: string): string => facts.sheet.periods.find((p) => p.id === id)?.label ?? id;
  return ready({
    rows: shown.map((r) => ({ period: label(r.periodId), currency: r.currency, budget: parseFigure(r.budget), budgetText: r.budget, expenditure: parseFigure(r.expenditure), expenditureText: r.expenditure, burnRatePercent: r.burnRatePercent ?? null, verified: r.verified })),
  }, shown.some((r) => !r.verified) ? ["Some figures are not verified yet."] : []);
};
