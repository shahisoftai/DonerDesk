import type { DataSheet } from "../reporting/data-sheet.js";
import type { AlertInput, AlertRule } from "./alerts.js";

const num = (text: string | undefined): number | null => {
  if (text === undefined || text.trim() === "") return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * What an alert looks at, read from the project's data sheet: the latest period that has a figure and the one before it, and the
 * target. A "no value" rule looks at the latest period that has already ended: nothing recorded there is the thing it watches for.
 * An indicator answered "not applicable" is a figure that is not there, never a zero. Returns null when the indicator is not in the sheet.
 */
export function alertInputFromSheet(sheet: DataSheet, indicatorId: string, rule: AlertRule, today: string): AlertInput | null {
  const ind = sheet.indicators.find((i) => i.id === indicatorId);
  if (!ind) return null;
  const order = [...sheet.periods].sort((a, b) => a.start.localeCompare(b.start));
  const valueIn = (periodId: string): number | null => {
    const cell = sheet.cells.find((c) => c.indicatorId === indicatorId && c.periodId === periodId);
    if (!cell || cell.notApplicable) return null;
    const shareOfTarget = rule.kind === "BELOW_PERCENT_OF_TARGET" && cell.cumulativeValue.trim() !== "";
    return num(shareOfTarget ? cell.cumulativeValue : cell.periodValue);
  };
  if (rule.kind === "NO_VALUE") {
    const ended = order.filter((p) => p.end <= today).at(-1);
    return { current: ended ? valueIn(ended.id) : null };
  }
  const withFigure = order.filter((p) => valueIn(p.id) !== null);
  const latest = withFigure.at(-1);
  const before = withFigure.at(-2);
  return {
    current: latest ? valueIn(latest.id) : null,
    previous: before ? valueIn(before.id) : null,
    target: num(ind.target),
    lowerIsBetter: ind.lowerIsBetter === true,
    isRate: ind.isRate,
  };
}

/** One plain sentence for the person told; ids and figures only, no text from the records. */
export function describeAlert(rule: AlertRule, name: string, input: AlertInput): string {
  const now = input.current === null ? "has no figure" : `is now ${input.current}`;
  switch (rule.kind) {
    case "BELOW": return `${name} ${now}, below your limit of ${rule.value}.`;
    case "ABOVE": return `${name} ${now}, above your limit of ${rule.value}.`;
    case "NO_VALUE": return `${name} has no figure for the latest period that has ended.`;
    case "BELOW_PERCENT_OF_TARGET": return `${name} ${now}, under ${rule.value}% of its target.`;
    case "WORSE_THAN_PREVIOUS": return `${name} ${now}, worse than the period before.`;
  }
}
