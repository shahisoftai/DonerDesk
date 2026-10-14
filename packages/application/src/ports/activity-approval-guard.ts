import type { Result, TenantId } from "@donordesk/domain";

/** What the guard needs to know about a record; a narrow view so callers do not pass the whole aggregate. */
export interface GuardedActivity {
  id: string;
  projectId: string;
  reportingPeriodId: string;
  activityDate: Date;
}

/** Answers one question for the handlers that undo an accepted activity: did a report that has been approved use it? */
export interface IActivityApprovalGuard {
  /** The names of the approved reports that used the record (empty when none did). */
  approvedReportsUsing(tenantId: TenantId, activity: GuardedActivity): Promise<Result<string[]>>;
}
