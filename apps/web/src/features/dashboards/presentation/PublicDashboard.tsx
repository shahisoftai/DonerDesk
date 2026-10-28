"use client";

import { useMemo } from "react";
import type { DashboardWidget } from "@donordesk/domain/contexts/dashboards/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { DashboardCanvas } from "./DashboardCanvas";

/** The read-only dashboard a link holder sees: the same grid, never editable. */
export function PublicDashboard({ widgets, charts }: { widgets: DashboardWidget[]; charts: ChartDrawing[] }) {
  const byId = useMemo(() => new Map(charts.map((c) => [c.widgetId, c])), [charts]);
  return <DashboardCanvas widgets={widgets} charts={byId} editing={false} labels={{}} onChange={() => undefined} />;
}
