"use client";

import { useMemo } from "react";
import type { DashboardWidget } from "@donordesk/domain/contexts/dashboards/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { DashboardCanvas } from "./DashboardCanvas";
import { DashboardTabBar, useDashboardTabs } from "./DashboardTabs";
import { ShareLinkProvider } from "./ShareLinkContext";

/** The read-only dashboard a link holder sees: the same tabs and grid, never editable. */
export function PublicDashboard({ widgets, charts, token }: { widgets: DashboardWidget[]; charts: ChartDrawing[]; /** The link this page was opened with: results maps use it to read other levels and periods. */ token: string }) {
  const byId = useMemo(() => new Map(charts.map((c) => [c.widgetId, c])), [charts]);
  const tabbed = useDashboardTabs(widgets);
  return (
    <ShareLinkProvider value={{ token }}>
    <div className="space-y-3">
      <DashboardTabBar tabs={tabbed.tabs} active={tabbed.active} onSelect={tabbed.setActive} overviewLabel="Overview" />
      <DashboardCanvas widgets={tabbed.visible} charts={byId} editing={false} labels={{}} onChange={() => undefined} />
    </div>
    </ShareLinkProvider>
  );
}
