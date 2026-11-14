"use client";

import type { DataChartSpec } from "@donordesk/domain/contexts/reporting/data-charts.js";
import { AddToDashboard } from "./AddToDashboard";

/** "Add this chart to a dashboard" on the Data Center: the shared control (plan F24) with one choice. */
export function AddToDashboardPanel({ projectId, spec, disabledReason }: { projectId: string; spec: DataChartSpec; disabledReason?: string }) {
  return <AddToDashboard projectId={projectId} choices={[{ key: "chart", label: "Add the chart", input: disabledReason ? null : { spec }, ...(disabledReason ? { disabledReason } : {}) }]} />;
}
