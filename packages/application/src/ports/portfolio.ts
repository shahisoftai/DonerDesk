import type { Result, TenantId } from "@donordesk/domain";

/** An indicator in one project, with its latest verified value (null when none is verified yet) (phase 28.1-F). */
export interface PortfolioIndicatorRow {
  projectId: string;
  projectTitle: string;
  donorName: string;
  indicatorCode: string;
  indicatorName: string;
  unit: string | null;
  type: string;
  target: number | null;
  verifiedCumulative: number | null;
  verifiedAsOf: string | null;
  countedElsewhere: boolean;
  country: string;
  startDate: string;
  endDate: string;
}

/** Live (not archived) indicators of the given projects, each with the latest verified cumulative value. */
export interface IPortfolioValueReader {
  indicatorValues(projectIds: string[], tenantId: TenantId): Promise<Result<PortfolioIndicatorRow[]>>;
}
