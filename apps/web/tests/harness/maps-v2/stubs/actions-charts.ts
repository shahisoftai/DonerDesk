// Stand-in for the chart dataset action: the REAL domain resolver over a two-period sheet whose figures match the fixture place results.
import { resolveDataset } from "@donordesk/domain/contexts/reporting/dataset-query.js";

const periods = [
  { id: "p1", label: "January", start: "2026-01-01", end: "2026-01-31", reportType: "MONTHLY", locked: false },
  { id: "p2", label: "February", start: "2026-02-01", end: "2026-02-28", reportType: "MONTHLY", locked: false },
  { id: "p3", label: "March", start: "2026-03-01", end: "2026-03-31", reportType: "MONTHLY", locked: false },
];
const sheet = {
  projectId: "p1", periods, finance: [],
  indicators: [{ id: "i1", code: "IND-1", name: "People reached", level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "3000", isRate: false }],
  cells: [
    { indicatorId: "i1", periodId: "p1", periodValue: "700", cumulativeValue: "700", status: "VERIFIED" },
    { indicatorId: "i1", periodId: "p2", periodValue: "800", cumulativeValue: "1500", status: "VERIFIED" },
    { indicatorId: "i1", periodId: "p3", periodValue: "900", cumulativeValue: "2400", status: "VERIFIED" },
  ],
};

export async function resolveChartDatasetAction(_projectId: string, query: unknown) {
  return { ok: true as const, value: { key: "chart", dataset: resolveDataset(sheet as unknown as Parameters<typeof resolveDataset>[0], query as Parameters<typeof resolveDataset>[1]) } };
}
