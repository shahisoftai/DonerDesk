/**
 * Does the budget add up (Phase 37.2)? The categories read from the summary and the rows read from the detailed budget are
 * each added up and set against every total the budget states. Only the most detailed rows are counted (a row whose
 * reference has rows under it, "F2.9" over "F2.9.1", is a heading). A difference is advice: it is shown with both figures
 * and nothing is "fixed". Amounts in more than one currency are not added. Pure.
 */
import { normaliseAmountText } from "./apply-sheets.js";
import type { BudgetLineDef, ProjectSetupProposal, Proposed } from "./proposal.js";
import type { SetupProblem } from "./proposal-checks.js";

/** Totals that are the whole budget (sub-totals are not compared with the whole). */
const GRAND_TOTAL = /\b(total (estimated |project )?costs?|grand total|total budget|total du budget|presupuesto total)\b/i;

/** Rounding a budget sheet may carry; anything larger is a real difference. */
export const BUDGET_TOLERANCE = 1;

const live = (b: Proposed<BudgetLineDef>): boolean => b.status !== "REJECTED" && b.value !== null;

/** An amount as a number: a sheet's own number is plain; anything written for people goes through the locale-aware reading. */
export function parseAmount(raw: string | null): number | null {
  if (raw && /^-?\d+(\.\d+)?$/.test(raw.trim())) return Number(raw);
  const text = normaliseAmountText(raw);
  return text === null ? null : Number(text);
}

const amountOf = (b: BudgetLineDef): number | null => parseAmount(b.amount);

/** The rows with no row under them, by reference ("F 2.1" and "F2.1" are the same reference). */
export function leafRows(rows: ReadonlyArray<BudgetLineDef>): BudgetLineDef[] {
  const refOf = (r: BudgetLineDef): string => (r.ref ?? "").replace(/\s+/g, "");
  const refs = rows.map(refOf);
  return rows.filter((r) => {
    const ref = refOf(r);
    return !ref || !refs.some((other) => other !== ref && other.startsWith(`${ref}.`));
  });
}

const sum = (rows: ReadonlyArray<BudgetLineDef>): number | null => {
  let total = 0;
  for (const r of rows) {
    const n = amountOf(r);
    if (n === null) return null;
    total += n;
  }
  return total;
};

const shown = (n: number): string => String(Math.round(n * 100) / 100);

export function checkBudgetTotals(proposal: ProjectSetupProposal): SetupProblem[] {
  const rows = proposal.budget.filter(live).map((b) => b.value!);
  if (new Set(rows.map((r) => r.currency).filter(Boolean)).size > 1) return [];
  const totals = proposal.budget.map((b, i) => ({ b, i })).filter(({ b }) => live(b) && b.value!.kind === "TOTAL" && GRAND_TOTAL.test(b.value!.category ?? ""));
  const groups: Array<{ what: "CATEGORIES" | "DETAILS"; rows: BudgetLineDef[] }> = [
    { what: "CATEGORIES", rows: rows.filter((r) => (r.kind ?? "LINE") === "LINE") },
    { what: "DETAILS", rows: leafRows(rows.filter((r) => r.kind === "DETAIL")) },
  ];
  const problems: SetupProblem[] = [];
  for (const { b, i } of totals) {
    const stated = amountOf(b.value!);
    if (stated === null) continue;
    for (const group of groups) {
      if (group.rows.length === 0) continue;
      const counted = sum(group.rows);
      if (counted === null || Math.abs(counted - stated) <= BUDGET_TOLERANCE) continue;
      problems.push({
        code: "BUDGET_TOTAL_MISMATCH", path: `budget.${i}`, severity: "SOFT",
        message: `The budget states a total of ${shown(stated)}, but its ${group.what === "CATEGORIES" ? "categories" : "detailed rows"} add up to ${shown(counted)}.`,
        params: { stated: shown(stated), counted: shown(counted), what: group.what },
      });
    }
  }
  return problems;
}
