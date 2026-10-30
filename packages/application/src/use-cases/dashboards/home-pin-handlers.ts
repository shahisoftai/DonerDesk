import { DomainError, Permissions, canSeeDashboard, checkHomePin, reorderPins, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IDashboardRepository, IFeaturedDashboardRepository, IHomePinRepository } from "../../ports/dashboards.js";

/** A person's own pinned tiles (Phase 35.H4). Always the caller's: no handler takes a user id. */
export interface HomePinDto { id: string; kind: string; ref: string; title: string; detail: string; href: string; available: boolean; /** Shown to everyone by an administrator: cannot be unpinned by the person. */ shared?: boolean }
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });
const viewerOf = (ctx: AuthenticatedContext) => ({ userId: ctx.tenant.userId, canManageShared: Permissions.can(ctx.tenant.role as Role, "project.edit") });

export class ListHomePinsHandler {
  constructor(private readonly pins: IHomePinRepository, private readonly dashboards: IDashboardRepository, private readonly featured?: IFeaturedDashboardRepository) {}
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
    // Dashboards an administrator shows to everyone come after the person's own; one already pinned is not shown twice; one the person cannot open is left out.
    if (this.featured) {
      const shared = await this.featured.list(ctx.tenant.tenantId);
      if (shared.ok) {
        for (const f of shared.value) {
          if (mine.value.some((p) => p.ref === f.dashboardId)) continue;
          const d = await this.dashboards.findById(f.dashboardId, ctx.tenant.tenantId);
          if (!d.ok || !d.value || !canSeeDashboard(d.value, viewerOf(ctx))) continue;
          const n = d.value.widgets.length;
          out.push({ id: `shared-${f.id}`, kind: "DASHBOARD", ref: f.dashboardId, title: d.value.name, detail: `${n} ${n === 1 ? "tile" : "tiles"} · shared by your organisation`, href: `/dashboards/${d.value.id}`, available: true, shared: true });
        }
      }
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

/** Show a dashboard on everyone's Home, or stop (`org.manage`, audited). Only an organisation-wide dashboard can be shown to everyone: a personal one is not theirs to share. */
export class SetDashboardFeaturedHandler {
  constructor(private readonly ids: IIdGenerator, private readonly featured: IFeaturedDashboardRepository, private readonly dashboards: IDashboardRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}
  async handle(ctx: AuthenticatedContext, dashboardId: string, on: boolean): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "org.manage")) return { ok: false, error: DomainError.forbidden("You cannot choose what is shown on everyone's Home") };
    const d = await this.dashboards.findById(dashboardId, ctx.tenant.tenantId);
    if (!d.ok) return d;
    if (!d.value || !canSeeDashboard(d.value, viewerOf(ctx))) return { ok: false, error: DomainError.notFound("Dashboard", dashboardId) };
    if (on && d.value.scope !== "ORG") return { ok: false, error: DomainError.validation("Only a dashboard made for the whole organisation can be shown on everyone's Home.") };
    const done = on ? await this.featured.add({ id: this.ids.generate(), tenantId: ctx.tenant.tenantId, dashboardId, createdById: ctx.tenant.userId, createdAt: this.clock.now() }) : await this.featured.remove(dashboardId, ctx.tenant.tenantId);
    if (!done.ok) return done;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: on ? "dashboard.featured" : "dashboard.unfeatured", entityType: "dashboard", entityId: dashboardId });
    return ok(undefined);
  }
}

/** Whether a dashboard is shown on everyone's Home, for the button's state. */
export class IsDashboardFeaturedHandler {
  constructor(private readonly featured: IFeaturedDashboardRepository) {}
  async handle(ctx: AuthenticatedContext, dashboardId: string): Promise<Result<{ featured: boolean; canChange: boolean }, DomainError>> {
    const r = await this.featured.list(ctx.tenant.tenantId);
    if (!r.ok) return r;
    return ok({ featured: r.value.some((f) => f.dashboardId === dashboardId), canChange: Permissions.can(ctx.tenant.role as Role, "org.manage") });
  }
}
