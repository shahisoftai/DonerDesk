import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

export const SUPPORT = "SUPPORT";

/** 1234567.5 -> "1,234,567.50"; the same in every browser. */
export function money(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
}

/** The activities a budget line can pay for, by the address its choice is kept under. */
export function activityChoices(view: SetupDraftView): Array<{ key: string; label: string }> {
  return view.plan.map((p) => ({ key: p.planKey, label: p.value.title ?? p.planKey }));
}

/** Where a budget line was placed: an activity's name, the support cost, or nothing yet. */
export function placementLabel(view: SetupDraftView, budgetKey: string, supportLabel: string): string {
  const target = view.extras.finance.budgetPlan[budgetKey];
  if (target === undefined) return "";
  if (target === SUPPORT) return supportLabel;
  return view.plan.find((p) => p.planKey === target)?.value.title ?? target;
}

/** The currencies that appear in both funding and budget, and the ones that appear in only one (said, never added). */
export function currencyNote(view: SetupDraftView): boolean {
  const f = new Set(view.financeSummary.funding.map((x) => x.currency));
  const b = new Set(view.financeSummary.budget.map((x) => x.currency));
  return f.size + b.size > 0 && ([...f].some((c) => !b.has(c)) || [...b].some((c) => !f.has(c)) || f.size > 1 || b.size > 1);
}

/** The most frequent currency among funding lines, offered as the reporting currency; empty when there is none. */
export function suggestedCurrency(view: SetupDraftView): string {
  const counts = new Map<string, number>();
  for (const f of view.funding) { const c = f.value.currency; if (c) counts.set(c, (counts.get(c) ?? 0) + 1); }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
}

/** The budget line's open suggestion, if any. */
export const suggestionFor = (view: SetupDraftView, budgetKey: string) => view.budgetSuggestions.find((s) => s.budgetKey === budgetKey);

/** What a suggestion's target is called on screen. */
export function targetLabel(view: SetupDraftView, target: string, supportLabel: string): string {
  return target === SUPPORT ? supportLabel : view.plan.find((p) => p.planKey === target)?.value.title ?? target;
}
