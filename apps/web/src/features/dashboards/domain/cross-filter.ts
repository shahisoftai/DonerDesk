/**
 * Click-to-filter on a dashboard: a click on a bar or point whose label is a reporting period filters every chart to that period;
 * a second click on the same period clears it. Pure: the label a chart reports and the periods the dashboard knows go in, the next filter comes out.
 * Only a period label filters (a click on an indicator name or a place does nothing), so a click can never mean two things.
 */
export interface FilterPeriod { id: string; label: string }

const fold = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

export function periodForLabel(periods: readonly FilterPeriod[], label: string): string | null {
  const wanted = fold(label);
  if (!wanted) return null;
  return periods.find((p) => fold(p.label) === wanted)?.id ?? null;
}

/** The filter after a click: a period label sets it, the same one again clears it, anything else leaves it as it was. */
export function nextPeriodFilter(current: string, periods: readonly FilterPeriod[], clickedLabel: string): string {
  const id = periodForLabel(periods, clickedLabel);
  if (id === null) return current;
  return id === current ? "" : id;
}
