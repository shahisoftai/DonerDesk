import type { Result, SnapshotIndicator, TenantId } from "@donordesk/domain";

/** One question for the handlers that edit an indicator: what did the latest approved framework say about it? */
export interface IFrameworkApprovalReader {
  /** The indicator as the project's latest approved version records it; null when no version is approved or it is not in it. */
  approvedIndicator(projectId: string, indicatorId: string, tenantId: TenantId): Promise<Result<SnapshotIndicator | null>>;
}
