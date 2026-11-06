import type { AdaptationRecord, PlainDate, Result, TenantId } from "@donordesk/domain";

export interface IAdaptationRepository {
  create(a: AdaptationRecord, tenantId: TenantId): Promise<Result<AdaptationRecord>>;
  update(a: AdaptationRecord, tenantId: TenantId): Promise<Result<AdaptationRecord>>;
  findById(id: string, tenantId: TenantId): Promise<Result<AdaptationRecord | null>>;
  /** Newest first. */
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<AdaptationRecord[]>>;
  /** Those dated inside a period (inclusive), newest first. */
  findInRange(projectId: string, start: PlainDate, end: PlainDate, tenantId: TenantId): Promise<Result<AdaptationRecord[]>>;
}
