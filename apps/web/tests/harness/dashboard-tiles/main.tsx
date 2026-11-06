import { createRoot } from "react-dom/client";
import { computeMetric } from "@donordesk/domain/contexts/dashboards/index.js";
import { buildChart, datasetQueryFor } from "@donordesk/domain/contexts/reporting/chart-render.js";
import { resolveDataset } from "@donordesk/domain/contexts/reporting/dataset-query.js";
import type { ChartSpecV2 } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { DashboardView } from "@/features/dashboards/presentation/DashboardView";
import type { ChartDrawing, DashboardView as DashboardData } from "@/lib/server/schemas-dashboards";

const usd = (minor: number) => ({ minor, currency: "USD" });
const finance = {
  primaryCurrency: "USD",
  index: { obligated: [usd(9110000)], disbursed: [usd(4770000)], remaining: [usd(4340000)], spent: [usd(1180000)], otherFunding: [] },
  inPrimary: { obligated: { total: usd(9110000), needsRate: [] }, disbursed: { total: usd(4770000), needsRate: [] }, spent: { total: usd(1180000), needsRate: [] } },
};
const act = (id: string, status: string, signal = "ON_TIME") => ({ id, title: id, kind: "ACTIVITY" as const, start: "2026-01-01", end: "2026-03-01", status, signal, signalLabel: "" });
const plan = [...Array.from({ length: 5 }, (_, i) => act(`d${i}`, "DONE", "DONE")), ...Array.from({ length: 6 }, (_, i) => act(`p${i}`, "IN_PROGRESS")), ...Array.from({ length: 3 }, (_, i) => act(`n${i}`, i === 0 ? "PLANNED" : "PLANNED", i === 0 ? "LATE" : "ON_TIME"))];
const donutSpec = { version: 2, kind: "DONUT", title: "# of Activities by Status", dataset: { template: "PLAN_TIMELINE", indicatorIds: [], measure: "PERIOD", showTarget: false, includeDraft: false } } as unknown as ChartSpecV2;
const sheet = { projectId: "p1", periods: [], indicators: [], cells: [], finance: [] } as never;
const donut = buildChart(donutSpec, { ...resolveDataset(sheet, datasetQueryFor(donutSpec, [])), plan });
if (!donut.ok) throw new Error(donut.reason);

const tiles = [
  { id: "t1", query: { metric: "FIN_OBLIGATED", color: "ORANGE", title: "Awarded" }, x: 0, y: 0 },
  { id: "t2", query: { metric: "FIN_SPENT", color: "GREEN", title: "Obligated" }, x: 3, y: 0 },
  { id: "t3", query: { metric: "FIN_RECEIVED", color: "GREY", title: "Disbursed" }, x: 6, y: 0 },
  { id: "t4", query: { metric: "ACTIVITIES_TOTAL", color: "PURPLE" }, x: 9, y: 0 },
] as const;
const widgets = [
  ...tiles.map((t) => ({ id: t.id, projectId: "p1", kind: "METRIC" as const, metric: t.query as never, x: t.x, y: t.y, w: 3, h: 3 })),
  { id: "c1", projectId: "p1", kind: "CHART" as const, spec: donutSpec as never, x: 0, y: 3, w: 6, h: 5 },
  { id: "k1", projectId: "p1", kind: "KPI" as const, kpi: { indicatorId: "i1", includeDraft: true } as never, x: 6, y: 6, w: 6, h: 2 },
  { id: "m1", projectId: "p1", kind: "MAP" as const, map: { view: "RESULTS" } as never, x: 0, y: 8, w: 12, h: 8 },
  { id: "m2", projectId: "p1", kind: "MAP" as const, map: { view: "ACTIVITIES" } as never, x: 0, y: 16, w: 12, h: 8 },
  { id: "k2", projectId: "p1", kind: "KPI" as const, kpi: { indicatorId: "i1", includeDraft: true, color: "GREEN" } as never, x: 0, y: 24, w: 6, h: 3 },
  { id: "x1", projectId: "p1", kind: "TEXT" as const, text: "Management dashboard for the whole project.", x: 6, y: 3, w: 6, h: 3 },
];
const charts: ChartDrawing[] = [
  ...tiles.map((t) => ({ widgetId: t.id, metric: computeMetric(t.query as never, { plan, finance } as never) as never })),
  { widgetId: "c1", chart: { option: donut.option, title: donut.title, notes: donut.notes, unverified: 0, points: donut.provenance.points } },
  { widgetId: "k1", kpi: { title: "OC1 Children vaccinated", color: null, unit: "children", value: 420, periodLabel: "Feb 2026", target: "1000", percentOfTarget: 42, spark: [{ label: "Jan", value: 120 }, { label: "Feb", value: 300 }], unverified: false, notes: [] } as never },
  { widgetId: "m1", map: { view: "RESULTS", title: "Children vaccinated by place", projectId: "p1" } as never },
  { widgetId: "m2", map: { view: "ACTIVITIES", title: "Where activities are", projectId: "p1" } as never },
  { widgetId: "k2", kpi: { title: "Children reached", color: "GREEN", unit: "children", value: 420, periodLabel: "Feb 2026", target: null, percentOfTarget: null, spark: [{ label: "Jan", value: 120 }, { label: "Feb", value: 300 }], unverified: false, notes: [] } as never },
  { widgetId: "x1", text: "Management dashboard for the whole project." },
];
const dashboard = { id: "d1", name: "Management dashboard", scope: "ORG" as const, ownerId: "u1", mine: true, canEdit: true, chartCount: widgets.length, updatedAt: "2026-10-10T08:00:00.000Z", widgets } as unknown as DashboardData;

(window as unknown as { __h: object }).__h = { saves: [], refreshes: 0, reads: [] };
createRoot(document.getElementById("root")!).render(<div style={{ padding: 16, maxWidth: 1300 }}><DashboardView dashboard={dashboard} charts={charts} periods={[]} projectNames={{ p1: "Education in Guinea" }} /></div>);
