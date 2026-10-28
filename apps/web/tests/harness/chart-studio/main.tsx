import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/features/i18n/presentation/I18nProvider";
import { ChartStudio } from "@/features/charts/presentation/ChartStudio";

const periods = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((label, i) => ({ id: `p${i + 1}`, label, start: `2026-0${i + 1}-01`, end: `2026-0${i + 1}-28`, reportType: "MONTHLY", locked: false }));
const ind = (id: string, extra: Record<string, unknown> = {}) => ({ id, code: id.toUpperCase(), name: `Indicator ${id}`, level: "OUTPUT", type: "COUNT", unit: "people", baseline: "10", target: "200", isRate: false, ...extra });
const cells = (id: string, vals: Array<number | null>, cum: number[], status = "VERIFIED") => vals.flatMap((v, i) => (v === null ? [] : [{ indicatorId: id, periodId: `p${i + 1}`, periodValue: String(v), cumulativeValue: String(cum[i] ?? ""), status }]));
const sheet = {
  projectId: "p1", periods,
  finance: [
    { periodId: "p1", currency: "USD", budget: "1000", expenditure: "100", balance: "900", burnRatePercent: "10.0", verified: true },
    { periodId: "p2", currency: "USD", budget: "1000", expenditure: "250", balance: "750", burnRatePercent: "25.0", verified: true },
    { periodId: "p3", currency: "USD", budget: "1000", expenditure: "400", balance: "600", burnRatePercent: "40.0", verified: false },
  ],
  indicators: [ind("a", { level: "OUTCOME" }), ind("b", { target: "100" }), ind("c", { unit: "kits", target: "50" }), ind("r", { type: "PERCENTAGE", unit: "%", isRate: true, target: "90" })],
  cells: [
    ...cells("a", [10, 20, 30, 40, 50, 60], [10, 30, 60, 100, 150, 210]),
    ...cells("b", [5, 8, 6, 12, 9, 15], [5, 13, 19, 31, 40, 55], "DRAFT"),
    ...cells("c", [1, 2, null, 4, 5, 6], [1, 3, 3, 7, 12, 18]),
    ...cells("r", [60, 62, 65, 70, 72, 75], [60, 62, 65, 70, 72, 75]),
  ],
};
(window as unknown as { __h: object }).__h = { sheet, saved: [], versions: {}, saves: [], deletes: [], failNext: null, queries: [], n: 0, dashboardAdds: [] };

(window as unknown as { __extras: object }).__extras = {
  plan: [
    { id: "1", title: "Drill boreholes", kind: "ACTIVITY", start: "2026-01-05", end: "2026-02-20", status: "DONE", signal: "DONE", signalLabel: "Done" },
    { id: "2", title: "Train committees", kind: "ACTIVITY", start: "2026-02-01", end: "2026-04-30", status: "IN_PROGRESS", signal: "LATE", signalLabel: "Late" },
    { id: "3", title: "Handover", kind: "MILESTONE", start: "2026-05-15", end: "2026-05-15", status: "PLANNED", signal: "ON_TIME", signalLabel: "On time" },
  ],
  activityDays: [{ date: "2026-01-12", count: 2 }, { date: "2026-01-13", count: 1 }, { date: "2026-03-02", count: 4 }],
  places: [
    { name: "Sudan", path: "Sudan", level: 0, value: 500, partly: false, latitude: 15.5, longitude: 32.5 },
    { name: "Chad", path: "Chad", level: 0, value: 200, partly: false, latitude: 15, longitude: 19 },
    { name: "Atlantis", path: "Atlantis", level: 0, value: 50, partly: false },
    { name: "Kenya", path: "Kenya", level: 0, value: null, partly: false },
  ],
  budget: [
    { donor: "USAID", category: "Equipment", currency: "USD", budgeted: 1000, spent: 400 },
    { donor: "USAID", category: "Training", currency: "USD", budgeted: 500, spent: 200 },
    { donor: "EU", category: "Equipment", currency: "USD", budgeted: 300, spent: 0 },
  ],
};
createRoot(document.getElementById("root")!).render(
  <I18nProvider initialLocale={((new URLSearchParams(window.location.search).get("lang") ?? "en") as "en")}>
    <div style={{ padding: 16, maxWidth: 1360 }}>
      <ChartStudio
        projectId="p1"
        indicators={sheet.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit as string, isRate: i.isRate }))}
        periods={periods.map((p) => ({ id: p.id, label: p.label }))}
        initialCharts={[]}
        canShare
      />
    </div>
  </I18nProvider>,
);
