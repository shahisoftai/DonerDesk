import type { AutomationRuleKey, PlannedActivity, PlanRevision, Result, TenantId, PlainDate } from "@donordesk/domain";

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

/** A stored "predecessor must finish before successor starts" link (phase 28.1-A). */
export interface PlanDependencyRecord {
  id: string;
  tenantId: string;
  projectId: string;
  predecessorId: string;
  successorId: string;
  createdById: string;
  createdAt: Date;
}

/** Finish-to-start links between planned activities of one project. */
export interface IPlanDependencyRepository {
  /** Refuses a duplicate pair with a conflict. */
  add(link: PlanDependencyRecord): Promise<Result<void>>;
  /** True when a link was removed. */
  remove(predecessorId: string, successorId: string, tenantId: TenantId): Promise<Result<boolean>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<PlanDependencyRecord[]>>;
}

/** A custom field a project defines for its planned activities (phase 28.1-C). */
export interface ProjectFieldRecord {
  id: string;
  tenantId: string;
  projectId: string;
  key: string;
  label: string;
  type: string;
  choices: string[];
  createdById: string;
  createdAt: Date;
}

export interface IProjectFieldRepository {
  create(field: ProjectFieldRecord): Promise<Result<void>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<ProjectFieldRecord[]>>;
}

/** Values of custom fields on planned activities. A `null` value removes the stored one (blank stays blank). */
export interface ICustomFieldValueRepository {
  setValues(
    entity: { tenantId: string; projectId: string; entityId: string; userId: string; now: Date },
    values: ReadonlyArray<{ fieldId: string; value: string | null }>,
  ): Promise<Result<void>>;
  /** Only the fields that have a value. */
  findByEntity(entityId: string, tenantId: TenantId): Promise<Result<Record<string, string>>>;
}

/** A budget line on a planned activity (phase 28.1-D). Money in minor units. */
export interface BudgetLineRecord {
  id: string;
  tenantId: string;
  projectId: string;
  plannedActivityId: string;
  code: string;
  category: string;
  description: string;
  donorName: string;
  currency: string;
  amountMinor: number;
  createdById: string;
  createdAt: Date;
}

export interface BudgetExpenseRecord {
  id: string;
  tenantId: string;
  projectId: string;
  budgetLineId: string;
  expenseDate: string;
  amountMinor: number;
  description: string;
  createdById: string;
  createdAt: Date;
}

export interface IBudgetRepository {
  addLine(line: BudgetLineRecord): Promise<Result<void>>;
  countLines(plannedActivityId: string, tenantId: TenantId): Promise<Result<number>>;
  findLineById(id: string, tenantId: TenantId): Promise<Result<BudgetLineRecord | null>>;
  findLinesByItem(plannedActivityId: string, tenantId: TenantId): Promise<Result<BudgetLineRecord[]>>;
  addExpense(expense: BudgetExpenseRecord): Promise<Result<void>>;
  findExpensesByLines(lineIds: string[], tenantId: TenantId): Promise<Result<BudgetExpenseRecord[]>>;
}

/** How many planned activities a person can lead in a week; null = no limit (phase 28.1-J). */
export interface IMemberCapacityRepository {
  findMany(userIds: string[], tenantId: TenantId): Promise<Result<Map<string, number | null>>>;
  set(userId: string, value: number | null, by: { userId: string; now: Date }, tenantId: TenantId): Promise<Result<void>>;
}

/** Which automation rules a project has turned on. A rule with no stored choice is on by default (phase 28.1-K). */
export interface IAutomationSettings {
  enabledRules(projectId: string, tenantId: TenantId): Promise<Result<Set<AutomationRuleKey>>>;
  set(projectId: string, ruleKey: AutomationRuleKey, enabled: boolean, by: { userId: string; now: Date }, tenantId: TenantId): Promise<Result<void>>;
  /** Stored choices for a project: rule -> enabled. */
  stored(projectId: string, tenantId: TenantId): Promise<Result<Record<string, boolean>>>;
}

/** A beneficiary record as stored: case code and group only (phase 28.1-G). */
export interface BeneficiaryRecord {
  id: string;
  tenantId: string;
  projectId: string;
  caseCode: string;
  sex: string;
  ageGroup: string;
  location: string;
  enrolledOn: string;
  consentRecordedById: string;
  createdById: string;
  createdAt: Date;
}

export interface IBeneficiaryRepository {
  add(record: BeneficiaryRecord): Promise<Result<void>>;
  /** All or none: one statement, so a clash on any case code saves nothing. */
  addMany(records: BeneficiaryRecord[]): Promise<Result<void>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<BeneficiaryRecord[]>>;
}

/** Indicators a planned activity reports on (phase 28.1 gap closure). */
export interface IPlannedActivityIndicatorRepository {
  findIndicatorIds(plannedActivityId: string, tenantId: TenantId): Promise<Result<string[]>>;
  /** Replaces the set in one transaction. */
  replace(input: { tenantId: string; projectId: string; plannedActivityId: string; indicatorIds: string[]; userId: string; now: Date }): Promise<Result<void>>;
}

/** One progress record for a planned activity. Values are null when not recorded. */
export interface ProgressEntryRecord {
  id: string;
  tenantId: string;
  projectId: string;
  plannedActivityId: string;
  kind: "DAILY" | "WEEKLY" | "MONTHLY" | "END";
  from: string;
  to: string;
  values: { total: number | null; breakdowns: Record<string, number | null>; sessions: number | null; unique: number | null };
  narrative: { notes: string; summary: string; achievements: string; challenges: string; nextSteps: string; lessons: string };
  absorbedById: string | null;
  createdById: string;
  updatedById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProgressRepository {
  findByItem(plannedActivityId: string, tenantId: TenantId): Promise<Result<ProgressEntryRecord[]>>;
  /** Saves one entry and marks the entries it absorbs, in one transaction. A repeated day is a conflict. */
  save(entry: ProgressEntryRecord, absorbIds: string[]): Promise<Result<void>>;
  /** Removes an entry and releases the entries it had absorbed, in one transaction. */
  remove(id: string, plannedActivityId: string, tenantId: TenantId): Promise<Result<boolean>>;
}

/** The column mapping a project saves for KoboToolbox/ODK imports (phase 28.1-I). */
export interface IProjectSubmissionMappingRepository {
  find(projectId: string, tenantId: TenantId): Promise<Result<Record<string, string> | null>>;
  save(projectId: string, mapping: Record<string, string>, by: { userId: string; now: Date }, tenantId: TenantId): Promise<Result<void>>;
}

/** The people (by case code) a planned activity reached. */
export interface IBeneficiaryLinkRepository {
  findBeneficiaryIds(plannedActivityId: string, tenantId: TenantId): Promise<Result<string[]>>;
  /** Adds links in one statement; a person already linked is skipped. Returns how many were new. */
  add(input: { tenantId: string; projectId: string; plannedActivityId: string; beneficiaryIds: string[]; userId: string; now: Date }): Promise<Result<number>>;
  remove(plannedActivityId: string, beneficiaryIds: string[], tenantId: TenantId): Promise<Result<number>>;
}
