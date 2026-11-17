/**
 * The data panel (Phase 61.1): every indicator a project holds is listed, ready to put on the page. Choosing what to show is one step; the
 * block that suits it is made here. A question with one indicator becomes a number, a chart or a table; several become one chart (a
 * line over time, or a bar of their latest values) or one table. Pure; the honesty rules (a rate is never stacked or summed) stay in the
 * chart's validator, which runs on whatever this returns.
 */
export interface DataField { id: string; code: string; name: string }
export type DataIntent = "NUMBER" | "CHART" | "TABLE" | "COMPARE";
export interface SuggestedVisual { kind: "KPI" | "CHART" | "TABLE"; props: unknown }

const norm = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Fields that match the words typed (code or name); no words = all. */
export function filterFields(fields: ReadonlyArray<DataField>, query: string): DataField[] {
  const q = norm(query.trim());
  if (!q) return [...fields];
  return fields.filter((f) => norm(`${f.code} ${f.name}`).includes(q));
}

/** The block that shows these fields for this intent, or null when nothing is chosen. */
export function suggestVisualFor(ids: ReadonlyArray<string>, intent: DataIntent): SuggestedVisual | null {
  if (ids.length === 0) return null;
  if (intent === "NUMBER") return { kind: "KPI", props: { indicatorId: ids[0], includeDraft: false } };
  if (intent === "TABLE") return { kind: "TABLE", props: { query: { indicatorIds: [...ids], measure: "PERIOD", rows: "PERIOD", includeDraft: false } } };
  if (ids.length === 1) return { kind: "CHART", props: { spec: { version: 2, kind: "BAR", dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: [ids[0]], measure: "PERIOD", showTarget: true, includeDraft: false } } } };
  // Several indicators: over time as lines for a comparison; the latest value of each as bars otherwise.
  if (intent === "COMPARE") return { kind: "CHART", props: { spec: { version: 2, kind: "BAR", dataset: { template: "INDICATORS_PROGRESS", indicatorIds: [...ids], measure: "PERCENT_OF_TARGET", showTarget: false, includeDraft: false } } } };
  return { kind: "CHART", props: { spec: { version: 2, kind: "LINE", dataset: { template: "INDICATORS_OVER_TIME", indicatorIds: [...ids], measure: "PERIOD", showTarget: false, includeDraft: false } } } };
}
