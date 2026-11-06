import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/features/i18n/presentation/I18nProvider";
import { IndicatorEntryGrid } from "@/features/reporting/presentation/IndicatorEntryGrid";

(window as unknown as { __h: object }).__h = {
  saves: [], verified: [], enqueued: [], refreshes: 0, failNext: null, workbookCalls: 0, historyCalls: [],
  parse: { rows: [], warnings: [] },
  history: { entries: [{ at: "2026-10-03T09:30:00.000Z", by: "Amina", what: "Saved", change: "10 → 12" }, { at: "2026-10-01T08:00:00.000Z", by: "Amina", what: "Saved", change: "empty → 10" }] },
};

const mk = (id: string, code: string, name: string, over: Record<string, unknown> = {}) => ({
  id, logframeItemId: `l${id}`, code, name, type: "NUMBER", baseline: "0", target: "1000", unit: "people", aggregation: "SUM", disaggregationRequired: false,
  requiresDenominator: false, targetGroups: [], logframeLevel: "OUTPUT", logframeCode: null, logframeTitle: null, update: null, ...over,
});
const upd = (id: string, status: string, p: string, c: string, extra: Record<string, unknown> = {}) => ({ id: `u-${id}`, indicatorId: id, verificationStatus: status, periodAchievement: p, cumulativeAchievement: c, comments: "", updatedAt: "2026-10-01T00:00:00.000Z", ...extra });

const rows = [
  mk("a", "OUT-1", "People trained", { previous: { periodAchievement: "100", cumulativeAchievement: "400", periodEnd: "2026-09-30" }, logframeLevel: "OUTCOME", update: upd("a", "DRAFT", "10", "410") }),
  mk("b", "OUT-2", "Kits distributed", { target: "200" }),
  mk("c", "OUT-3", "Verified row", { update: upd("c", "VERIFIED", "5", "5") }),
  mk("d", "OUT-4", "Satisfaction", { type: "PERCENTAGE", unit: "%", target: "90" }),
  mk("e", "OUT-5", "Calculated ratio", { calculation: "OUT-1 ÷ OUT-2" }),
  mk("f", "OUT-6", "Women trained", { disaggregationRequired: true }),
  mk("g", "OUT-7", "Handed in row", { update: upd("g", "SUBMITTED", "2", "2") }),
];

createRoot(document.getElementById("root")!).render(
  <I18nProvider initialLocale="en">
    <div style={{ padding: 16, maxWidth: 1180 }}>
      <IndicatorEntryGrid
        projectId="p1"
        periodId="per1"
        rows={rows as never}
        canEdit
        canVerify
        today="2026-10-28"
        userId="u1"
        names={{}}
        history={{ periods: [{ id: "s", label: "Sep" }], values: { a: { s: "100" }, b: { s: "40" } } }}
        places={["Rabak", "Kosti"]}
      />
    </div>
  </I18nProvider>,
);
