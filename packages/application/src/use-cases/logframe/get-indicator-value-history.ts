import { DomainError, Permissions, describeValueHistory, type Result, type Role, type ValueAuditEvent, type ValueHistoryEntry } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IUserRepository } from "../../ports/identity.js";
import type { IAuditRepository } from "../../ports/support.js";

/**
 * The history of one saved indicator value: who saved, handed in, verified or returned it, when, and what the figure was before and
 * after. Read from the audit trail (nothing new is stored). Anyone who can see the project can read it; the project boundary has
 * already refused a value from a project the caller is not on.
 */
export class GetIndicatorValueHistoryHandler {
  constructor(
    private readonly updates: Pick<IIndicatorUpdateRepository, "findById">,
    private readonly audit: Pick<IAuditRepository, "listByTenant">,
    private readonly users: Pick<IUserRepository, "findById">,
  ) {}

  async handle(ctx: AuthenticatedContext, updateId: string): Promise<Result<{ entries: ValueHistoryEntry[] }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "project.view")) return { ok: false, error: DomainError.forbidden("You cannot see this value's history") };
    const found = await this.updates.findById(updateId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Indicator value", updateId) };
    const events = await this.audit.listByTenant(ctx.tenant.tenantId, { entityType: "indicator_update", entityId: updateId, limit: 200 });
    if (!events.ok) return events;
    const names = new Map<string, string>();
    for (const id of new Set(events.value.map((e) => e.actorId).filter(Boolean))) {
      const user = await this.users.findById(id, ctx.tenant.tenantId);
      if (user.ok && user.value) names.set(id, user.value.name);
    }
    const audited: ValueAuditEvent[] = events.value.map((e) => ({
      eventType: e.eventType, actorId: e.actorId, actorName: names.get(e.actorId), at: e.createdAt, oldValue: e.oldValue, newValue: e.newValue,
    }));
    return { ok: true, value: { entries: describeValueHistory(audited) } };
  }
}
