import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/features/i18n/presentation/I18nProvider";
import { ReportBuilder } from "@/features/report-builder/presentation/ReportBuilder";

const periods = ["Jan", "Feb", "Mar"].map((label, i) => ({ id: `p${i + 1}`, label, start: `2026-0${i + 1}-01`, end: `2026-0${i + 1}-28`, reportType: "MONTHLY", locked: false }));
const ind = (id: string, extra: Record<string, unknown> = {}) => ({ id, code: id.toUpperCase(), name: `Indicator ${id}`, level: "OUTPUT", type: "NUMBER", unit: "people", baseline: "0", target: "200", isRate: false, ...extra });
const split = (f: string, m: string) => [{ dimension: "SEX", category: "Female", value: f }, { dimension: "SEX", category: "Male", value: m }];
const sheet = {
  projectId: "p1", periods, finance: [],
  indicators: [ind("a"), ind("b", { unit: "kits" }), ind("r", { type: "PERCENTAGE", unit: "%", isRate: true, target: "90" })],
  cells: [
    { indicatorId: "a", periodId: "p1", periodValue: "10", cumulativeValue: "10", status: "VERIFIED" },
    { indicatorId: "a", periodId: "p2", periodValue: "20", cumulativeValue: "30", status: "VERIFIED" },
    { indicatorId: "a", periodId: "p3", periodValue: "30", cumulativeValue: "60", status: "DRAFT", breakdown: split("18", "12") },
    { indicatorId: "b", periodId: "p1", periodValue: "0", cumulativeValue: "0", status: "VERIFIED" },
    { indicatorId: "r", periodId: "p3", periodValue: "60", cumulativeValue: "60", status: "VERIFIED", breakdown: split("50", "70") },
  ],
};
(window as unknown as { __h: object }).__h = { sheet, queries: [], reports: [], reportSaves: [], n: 0, dashboardAdds: [] };
createRoot(document.getElementById("root")!).render(
  <I18nProvider initialLocale={((new URLSearchParams(window.location.search).get("lang") ?? "en") as "en")}>
    <div style={{ padding: 16, maxWidth: 1200 }}>
      <ReportBuilder projectId="p1" indicators={sheet.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name }))} periods={periods.map((p) => ({ id: p.id, label: p.label }))} initialReports={[]} canShare />
    </div>
  </I18nProvider>,
);
