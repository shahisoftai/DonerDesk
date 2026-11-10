import type { Result, TenantId } from "@donordesk/domain";

export interface StoredPlaceFlow {
  id: string; tenantId: TenantId; projectId: string; fromPlaceId: string; toPlaceId: string;
  what: string; quantity: number; unit: string; note?: string | undefined; createdById: string; createdAt: Date;
}

export interface IPlaceFlowRepository {
  create(flow: StoredPlaceFlow): Promise<Result<void>>;
  /** Deletes the flow only when it belongs to this project. */
  delete(id: string, tenantId: TenantId, projectId: string): Promise<Result<void>>;
  listByProject(tenantId: TenantId, projectId: string): Promise<Result<StoredPlaceFlow[]>>;
}
