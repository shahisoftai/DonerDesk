/**
 * What the Quick Entry screen decides before anything is sent: which indicators can be typed into, which one the filter
 * shows, where the date will land, what to do after a save. Pure, no React: the form only draws it.
 */
import { chooseQuickEntryPeriod, isQuickEntryDay } from "@donordesk/domain/contexts/logframe/quick-entry.js";
import { periodOptionLabel } from "../../../lib/shared/option-labels.ts";

export interface QuickIndicator {
  id: string;
  code: string;
  name: string;
  unit?: string | undefined;
  type?: string | undefined;
  disaggregationRequired?: boolean | undefined;
  /** Calculated from other indicators: never typed. */
  formula?: unknown;
}

export interface QuickPeriod {
  id: string;
  reportType: string;
  startDate: string;
  endDate: string;
  cancelled?: boolean | undefined;
  status?: string | undefined;
}

/** A report whose figures are locked takes no new values (mirrors the server's `isPeriodLocked`). */
export function isLockedStatus(status: string | undefined): boolean {
  return status === "APPROVED" || status === "SUBMITTED" || status === "CLOSED";
}

/** The indicators a person can type a value into: calculated ones are left out. */
export function enterableIndicators(indicators: ReadonlyArray<QuickIndicator>): QuickIndicator[] {
  return indicators.filter((i) => !i.formula);
}

/** Case- and accent-insensitive match on code and name; an empty filter shows everything. */
export function filterIndicators(indicators: ReadonlyArray<QuickIndicator>, text: string): QuickIndicator[] {
  const q = fold(text.trim());
  if (q === "") return [...indicators];
  return indicators.filter((i) => fold(`${i.code} ${i.name}`).includes(q));
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type DateLanding =
  | { kind: "FOUND"; periodId: string; label: string; locked: boolean }
  | { kind: "NONE"; message: string }
  | { kind: "INVALID"; message: string };

/** Where a typed date will be recorded, in words the person can check before saving. */
export function dateLanding(date: string, periods: ReadonlyArray<QuickPeriod>): DateLanding {
  const live = periods.filter((p) => !p.cancelled);
  const choice = chooseQuickEntryPeriod({ date, periods: live.map((p) => ({ id: p.id, startDate: p.startDate, endDate: p.endDate })) });
  if (!choice.ok) return { kind: choice.code === "BAD_DATE" ? "INVALID" : "NONE", message: choice.message };
  const period = live.find((p) => p.id === choice.periodId)!;
  return { kind: "FOUND", periodId: period.id, label: periodOptionLabel(period), locked: isLockedStatus(period.status) };
}

/** After a save the person usually carries on with the next indicator of the list. */
export function nextIndicatorId(indicators: ReadonlyArray<QuickIndicator>, currentId: string): string {
  const at = indicators.findIndex((i) => i.id === currentId);
  if (at < 0 || indicators.length === 0) return currentId;
  return indicators[(at + 1) % indicators.length]!.id;
}

export { isQuickEntryDay };

/** Can the value be sent as typed? A figure is required unless the indicator is being skipped; only numbers are checked here, the server decides the rest. */
export function valueProblem(value: string): string | null {
  const v = value.trim();
  if (v === "") return "Type the value.";
  return null;
}

/** The row an offline queue entry stores: exactly what the sheet's save would send for one value (a breakdown travels with it). */
export function offlineRow(input: { indicatorId: string; value: string; note?: string; source?: string; disaggregation?: ReadonlyArray<{ dimension: string; category: string; value: string }> }): Record<string, unknown> {
  return {
    indicatorId: input.indicatorId,
    periodAchievement: input.value.trim(),
    cumulativeAchievement: "",
    ...(input.note?.trim() ? { comments: input.note.trim() } : {}),
    ...(input.source?.trim() ? { dataSource: input.source.trim() } : {}),
    ...(input.disaggregation && input.disaggregation.length > 0 ? { disaggregation: input.disaggregation.map((d) => ({ ...d })) } : {}),
  };
}
