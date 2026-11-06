/** Plain words and bar widths for a budget line (phase 28.1-D). Pure, so it is unit-tested. */
export const BUDGET_STATE_WORDS: Readonly<Record<string, string>> = {
  NO_BUDGET: "No budget set",
  NOT_STARTED: "Nothing spent yet",
  UNDER_SPENT: "Within budget",
  FULLY_SPENT: "Fully spent",
  OVERSPENT: "Over budget",
};

export const BUDGET_CATEGORY_WORDS: Readonly<Record<string, string>> = {
  PERSONNEL: "Staff and volunteers", TRAVEL: "Travel", SUPPLIES: "Supplies", EQUIPMENT: "Equipment", SERVICES: "Services", OTHER: "Other",
};

/** Width of the spent bar, capped at 100 so an overspend shows as a full bar with its flag beside it. */
export function spentBarPercent(spentPercent: number | null): number {
  if (spentPercent === null) return 0;
  return Math.min(100, Math.max(0, spentPercent));
}
