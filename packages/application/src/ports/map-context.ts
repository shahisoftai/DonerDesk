import type { Result, TenantId } from "@donordesk/domain";

/** An organisation's map context settings (Phase 49.6), stored as the checked JSON. No row = the default. */
export interface IMapContextRepository {
  find(tenantId: TenantId): Promise<Result<{ settingsJson: string; updatedAt: Date } | null>>;
  save(tenantId: TenantId, settingsJson: string, updatedById: string): Promise<Result<void>>;
}
