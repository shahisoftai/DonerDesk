/**
 * The map's time slider: step 0 is "All periods" (the whole project), then one step per reporting period in the order given.
 * Pure, so the slider's index maths is tested apart from the component.
 */
export interface PeriodStep {
  /** null = all periods. */
  periodId: string | null;
  label: string;
}

export function periodSteps(periods: ReadonlyArray<{ id: string; label: string }>): PeriodStep[] {
  return [{ periodId: null, label: "All periods" }, ...periods.map((p) => ({ periodId: p.id, label: p.label }))];
}

export const stepIndex = (steps: readonly PeriodStep[], periodId: string | null): number => Math.max(0, steps.findIndex((s) => s.periodId === periodId));

/** The step after `index`, wrapping from the last period back to the first period (never back to "All"). */
export function nextPlayStep(steps: readonly PeriodStep[], index: number): number {
  if (steps.length <= 1) return 0;
  return index + 1 >= steps.length ? 1 : Math.max(1, index + 1);
}
