import { DomainError, Permissions, canSeeDashboard, checkHomePin, reorderPins, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IDashboardRepository, IHomePinRepository } from "../../ports/dashboards.js";

/** A person's own pinned tiles (Phase 35.H4). Always the caller's: no handler takes a user id. */
export interface HomePinDto { id: string; kind: string; ref: string; title: string; detail: string; href: string; available: boolean }
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });
const viewerOf = (ctx: AuthenticatedContext) => ({ userId: ctx.tenant.userId, canManageShared: Permissions.can(ctx.tenant.role as Role, "project.edit") });

export class ListHomePinsHandler {
  constructor(private readonly pins: IHomePinRepository, private readonly dashboards: IDashboardRepository) {}
  async handle(ctx: AuthenticatedContext): Promise<Result<{ pins: HomePinDto[] }, DomainError>> {
    const mine = await this.pins.listForUser(ctx.tenant.tenantId, ctx.tenant.userId);
    if (!mine.ok) return mine;
    const out: HomePinDto[] = [];
    for (const p of mine.value) {
      const d = await this.dashboards.findById(p.ref, ctx.tenant.tenantId);
      if (!d.ok) return d;
      // Gone or no longer visible: said so, never hidden (the person can remove the pin).
      if (!d.value || !canSeeDashboard(d.value, viewerOf(ctx))) { out.push({ id: p.id, kind: p.kind, ref: p.ref, title: "A dashboard you can no longer open", detail: "It was deleted or is no longer shared with you.", href: "/dashboards", available: false }); continue; }
      const n = d.value.widgets.length;
      out.push({ id: p.id, kind: p.kind, ref: p.ref, title: d.value.name, detail: `${n} ${n === 1 ? "tile" : "tiles"}`, href: `/dashboards/${d.value.id}`, available: true });
    }
    return ok({ pins: out });
  }
}

export class AddHomePinHandler {
  constructor(private readonly ids: IIdGenerator, private readonly pins: IHomePinRepository, private readonly dashboards: IDashboardRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}
  async handle(ctx: AuthenticatedContext, input: { kind: string; ref: string }): Promise<Result<{ id: string }, DomainError>> {
    const mine = await this.pins.listForUser(ctx.tenant.tenantId, ctx.tenant.userId);
    if (!mine.ok) return mine;
    const checked = checkHomePin(input, mine.value);
    if (!checked.ok) return { ok: false, error: DomainError.validation(checked.problem.message) };
    const target = await this.dashboards.findById(checked.value.ref, ctx.tenant.tenantId);
    if (!target.ok) return target;
    if (!target.value || !canSeeDashboard(target.value, viewerOf(ctx))) return { ok: false, error: DomainError.notFound("Dashboard", checked.value.ref) };
    const id = this.ids.generate();
    const saved = await this.pins.create({ id, tenantId: ctx.tenant.tenantId, userId: ctx.tenant.userId, ...checked.value, position: mine.value.length, createdAt: this.clock.now() });
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "home_pin.added", entityType: "home_pin", entityId: id });
    return ok({ id });
  }
}

export class RemoveHomePinHandler {
  constructor(private readonly pins: IHomePinRepository, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    const r = await this.pins.delete(id, ctx.tenant.tenantId, ctx.tenant.userId);
    if (!r.ok) return r;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "home_pin.removed", entityType: "home_pin", entityId: id });
    return ok(undefined);
  }
}

export class MoveHomePinHandler {
  constructor(private readonly pins: IHomePinRepository) {}
  async handle(ctx: AuthenticatedContext, id: string, to: number): Promise<Result<void, DomainError>> {
    const mine = await this.pins.listForUser(ctx.tenant.tenantId, ctx.tenant.userId);
    if (!mine.ok) return mine;
    if (!mine.value.some((p) => p.id === id)) return { ok: false, error: DomainError.notFound("Pin", id) };
    return this.pins.setOrder(ctx.tenant.tenantId, ctx.tenant.userId, reorderPins(mine.value.map((p) => p.id), id, to));
  }
}
