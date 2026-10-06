import type { Result, TenantId } from "@donordesk/domain";

/** Answers one question for the handlers that move or remove an indicator: did a report that has been approved use its values? */
export interface IIndicatorApprovalGuard {
  isUsedInApprovedReport(tenantId: TenantId, indicatorId: string): Promise<Result<boolean>>;
}
