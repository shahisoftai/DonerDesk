import type { CollectionIndicator, CollectionPeriod, PlainDate, ProjectRiskTrend, Result, TenantId } from "@donordesk/domain";

/** What is needed to tell which indicator values are due in one project. Read once per project by the reader. */
export interface CollectionFacts {
  projectId: string;
  projectTitle: string;
  projectStart: PlainDate;
  meOfficerId?: string;
  projectManagerId?: string;
  /** Days after a period ends that its values are due (the reporting profile's setting; 5 when it has none). */
  dueDays: number;
  indicators: CollectionIndicator[];
  periods: CollectionPeriod[];
  /** "indicatorId|periodId" for every value that is recorded. */
  recorded: ReadonlySet<string>;
}

export interface ICollectionFactsReader {
  /** One entry per project (all of the tenant's active projects when `projectIds` is absent). */
  forProjects(tenantId: TenantId, projectIds?: ReadonlyArray<string>): Promise<Result<CollectionFacts[]>>;
}

/** Stored daily snapshots of a project's risk (the history behind the health label). */
export interface IRiskTrendStore {
  /** One snapshot per project per day: saving the same day again replaces it. */
  save(trend: ProjectRiskTrend): Promise<Result<void>>;
  history(projectId: string, tenantId: TenantId, limit: number): Promise<Result<ProjectRiskTrend[]>>;
}

/** Called after a reminder run so each project's risk snapshot is kept up to date once a day. */
export interface IRiskRefresh {
  refreshAll(tenantId: TenantId, today: PlainDate): Promise<void>;
}

/** Days after a period ends that its indicator values are due (the project's reporting profile; 5 when it has none). */
export interface IEntryDueDays {
  forProject(projectId: string, tenantId: TenantId): Promise<number>;
}
