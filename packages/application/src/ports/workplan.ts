import type { PlannedActivity, PlanRevision, Result, TenantId, PlainDate } from "@donordesk/domain";

/** Persistence of the planned-activity aggregate. */
export interface IPlannedActivityRepository {
  create(item: PlannedActivity): Promise<Result<PlannedActivity>>;
  /** Creates several at once, all or none (a recurring series, the logframe wizard). */
  createMany(items: PlannedActivity[]): Promise<Result<PlannedActivity[]>>;
  update(item: PlannedActivity): Promise<Result<PlannedActivity>>;
  findById(id: string, tenantId: TenantId): Promise<Result<PlannedActivity | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<PlannedActivity[]>>;
  findBySeries(seriesId: string, tenantId: TenantId): Promise<Result<PlannedActivity[]>>;
}

/** Append-only plan history. */
export interface IPlanRevisionRepository {
  append(revision: PlanRevision): Promise<Result<void>>;
  findByPlannedActivity(plannedActivityId: string, tenantId: TenantId): Promise<Result<PlanRevision[]>>;
  findRecentByProject(projectId: string, tenantId: TenantId, limit: number): Promise<Result<PlanRevision[]>>;
}

/** Facts about the project the plan rules need, supplied by infrastructure (members, report use). */
export interface IPlanContextReader {
  activeMemberIds(projectId: string, tenantId: TenantId): Promise<Result<ReadonlySet<string>>>;
  /** True when a non-cancelled period covering these dates has a generated report draft. */
  reportUsesDates(projectId: string, tenantId: TenantId, range: { start: PlainDate; end: PlainDate }): Promise<Result<boolean>>;
  /** The date ranges of the project's non-cancelled periods that have a generated report draft (one query for a whole list). */
  reportCoveredRanges(projectId: string, tenantId: TenantId): Promise<Result<ReadonlyArray<{ start: PlainDate; end: PlainDate }>>>;
  projectDates(projectId: string, tenantId: TenantId): Promise<Result<{ start: PlainDate; end: PlainDate } | null>>;
}

/** Completed activities per planned activity (withdrawn ones already left out), for the delivery state. */
export interface IDeliveryFactsReader {
  factsByPlannedActivity(projectId: string, tenantId: TenantId): Promise<Result<ReadonlyMap<string, import("@donordesk/domain").DeliveryFacts>>>;
}

/** Active project members by email, so an imported "Lead email" can be resolved. */
export interface IMemberDirectory {
  activeUserIdsByEmail(projectId: string, tenantId: TenantId): Promise<Result<ReadonlyMap<string, string>>>;
}

export interface MyWeekSentBack {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  activityDate: string;
  status: "NEEDS_REVISION" | "REJECTED";
}

/** What a person's own week is made of, across every project they work on (projects with work planning hidden are left out). */
export interface IMyWeekReader {
  /** Open planned activities the person leads or helps with that start on or before `startsOnOrBefore` (late ones included). */
  openPlannedFor(userId: string, tenantId: TenantId, startsOnOrBefore: PlainDate): Promise<Result<Array<{ item: PlannedActivity; projectTitle: string }>>>;
  /** Completed activities the person submitted that a reviewer sent back. */
  sentBackFor(userId: string, tenantId: TenantId): Promise<Result<MyWeekSentBack[]>>;
}
