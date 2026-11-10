import type { Result, TenantId, AlertRuleKind, AlertState } from "@donordesk/domain";

export interface StoredDataAlert {
  id: string; tenantId: TenantId; userId: string; role: string; projectId: string; indicatorId: string;
  ruleKind: AlertRuleKind; ruleValue: number | null; lastState: AlertState; createdAt: Date;
}

export interface IDataAlertRepository {
  create(a: StoredDataAlert): Promise<Result<void>>;
  /** Deletes only the person's own alert. */
  delete(id: string, tenantId: TenantId, userId: string): Promise<Result<void>>;
  listForUser(tenantId: TenantId, userId: string): Promise<Result<StoredDataAlert[]>>;
  listAll(tenantId: TenantId): Promise<Result<StoredDataAlert[]>>;
  setState(id: string, tenantId: TenantId, state: AlertState): Promise<Result<void>>;
}
