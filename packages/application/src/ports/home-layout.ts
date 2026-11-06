import type { Result, TenantId } from "@donordesk/domain";

export interface StoredHomeLayout { id: string; tenantId: TenantId; userId: string; variant: string; layoutJson: string; updatedAt: Date }

/** A person's own Home layout. Every call is scoped to the person and the Home variant: nothing reads or changes another's. */
export interface IHomeLayoutRepository {
  find(tenantId: TenantId, userId: string, variant: string): Promise<Result<StoredHomeLayout | null>>;
  /** Creates the row when `expected` is null, otherwise replaces it only if it is still the version read. False = someone saved since (a second tab). */
  save(row: Omit<StoredHomeLayout, "updatedAt">, expected: Date | null): Promise<Result<boolean>>;
  delete(tenantId: TenantId, userId: string, variant: string): Promise<Result<void>>;
}
