import type { FacilityType, Result, TenantId } from "@donordesk/domain";

/** An organisation's own facility types (Phase 50.3b), kept on the organisation row. */
export interface IFacilityTypeRepository {
  find(tenantId: TenantId): Promise<Result<FacilityType[]>>;
  save(tenantId: TenantId, types: FacilityType[]): Promise<Result<void>>;
}
