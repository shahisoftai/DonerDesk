import type { Result, TenantId } from "@donordesk/domain";

export interface StoredDonorIndicatorDecision {
  requirementId: string;
  /** The project indicator that answers the donor's requirement; null = this project will not report it. */
  indicatorId: string | null;
}

export interface IDonorIndicatorMappingRepository {
  listByTemplate(templateId: string, tenantId: TenantId): Promise<Result<StoredDonorIndicatorDecision[]>>;
  /** Records (or replaces) the decision for one requirement. */
  save(input: { id: string; tenantId: TenantId; templateId: string; requirementId: string; indicatorId: string | null; decidedById: string }): Promise<Result<void>>;
  /** Forgets the decision, so the requirement is matched automatically again. */
  clear(templateId: string, requirementId: string, tenantId: TenantId): Promise<Result<void>>;
}
