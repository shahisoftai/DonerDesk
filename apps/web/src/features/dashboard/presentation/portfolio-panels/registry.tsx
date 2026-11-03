import type { ReactNode } from "react";
import type { LayoutPanel } from "../../domain/home-layout";
import type { PortfolioHomeData } from "../../application/portfolio-home-model";
import { BreakdownsPanel, FundingPanel, HeadlinesPanel, MapPanel } from "./headline-panels";
import { PipelinePanel, ProjectHealthPanel, ResultsPanel, RisksPanel, UpcomingReportsPanel } from "./project-panels";
import { DataEvidencePanel, DeliveryPanel, GrantsPanel, NotificationsPanel, QuickLinksPanel, YourWorkPanel } from "./work-panels";

/** A panel reads the Home data and answers its content, or `null` when it has nothing to say to this person. */
export type PortfolioPanelRenderer = (data: PortfolioHomeData) => ReactNode | null;

/**
 * One row per arranged panel. The type is exhaustive over `LayoutPanel`, so adding a panel to the layout without a renderer here does not compile;
 * adding one never changes the grid, the layout rules or another panel.
 */
export const PORTFOLIO_PANELS: Readonly<Record<LayoutPanel, PortfolioPanelRenderer>> = {
  HEADLINES: HeadlinesPanel,
  FUNDING: FundingPanel,
  MAP: MapPanel,
  BREAKDOWNS: BreakdownsPanel,
  PROJECT_HEALTH: ProjectHealthPanel,
  UPCOMING_REPORTS: UpcomingReportsPanel,
  PIPELINE: PipelinePanel,
  RESULTS: ResultsPanel,
  RISKS: RisksPanel,
  DELIVERY: DeliveryPanel,
  DATA_EVIDENCE: DataEvidencePanel,
  NOTIFICATIONS: NotificationsPanel,
  YOUR_WORK: YourWorkPanel,
  GRANTS: GrantsPanel,
  QUICK_LINKS: QuickLinksPanel,
};
