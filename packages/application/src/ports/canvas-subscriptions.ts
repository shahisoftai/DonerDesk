import type { Result, TenantId } from "@donordesk/domain";

export type SubscriptionEvery = "WEEKLY" | "MONTHLY";
export interface StoredCanvasSubscription { id: string; tenantId: TenantId; canvasId: string; userId: string; every: SubscriptionEvery; lastSentAt?: Date | undefined; createdAt: Date }

export interface ICanvasSubscriptionRepository {
  /** One subscription per person per canvas: choosing again changes the schedule. */
  upsert(s: StoredCanvasSubscription): Promise<Result<void>>;
  remove(canvasId: string, tenantId: TenantId, userId: string): Promise<Result<void>>;
  listForUser(tenantId: TenantId, userId: string): Promise<Result<StoredCanvasSubscription[]>>;
  listAll(tenantId: TenantId): Promise<Result<StoredCanvasSubscription[]>>;
  setSent(id: string, tenantId: TenantId, at: Date): Promise<Result<void>>;
}
