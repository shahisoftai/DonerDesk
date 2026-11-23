import { DomainError, draftIsExpired, type Result, type TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { ICollectionDraftRepository } from "../../ports/collection.js";
import { can, fail, ok, placeKeyOf } from "./assessment-common.js";

/** Removes the person's own draft. */
export class DiscardCollectionDraftHandler {
  constructor(private readonly drafts: Pick<ICollectionDraftRepository, "delete">) {}

  async handle(ctx: AuthenticatedContext, formId: string, placeId?: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "collection.submit")) return fail(DomainError.forbidden("You cannot fill forms"));
    return this.drafts.delete(formId, ctx.tenant.userId, placeKeyOf(placeId), ctx.tenant.tenantId);
  }
}

/** Run from the hourly job for an organisation: drafts not saved for the stated number of days are removed (counted in the audit trail, never read). */
export class ExpireCollectionDraftsHandler {
  constructor(private readonly drafts: Pick<ICollectionDraftRepository, "listOlderThan" | "deleteIds">, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(tenantId: TenantId): Promise<Result<{ removed: number }, DomainError>> {
    const now = this.clock.now();
    const old = await this.drafts.listOlderThan(new Date(now.getTime() - 24 * 3_600_000), tenantId);
    if (!old.ok) return old;
    const expired = old.value.filter((d) => draftIsExpired(d.updatedAt, now));
    if (expired.length === 0) return ok({ removed: 0 });
    const removed = await this.drafts.deleteIds(expired.map((d) => d.id), tenantId);
    if (!removed.ok) return removed;
    await this.audit.record({ tenantId, actorId: "system", eventType: "collection.drafts.expired", entityType: "collection_draft", entityId: "batch", newValue: JSON.stringify({ count: expired.length }) });
    return ok({ removed: expired.length });
  }
}
