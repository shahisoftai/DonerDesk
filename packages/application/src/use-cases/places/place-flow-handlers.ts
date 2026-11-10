import { DomainError, FLOW_LIMITS, checkPlaceFlow, err, ok, type Result } from "@donordesk/domain";
import type { AddPlaceFlowInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IPlaceFlowRepository, StoredPlaceFlow } from "../../ports/place-flows.js";
import { canEdit, canView, loadAll } from "./place-support.js";

/**
 * Movements between places (Phase 48.12). Reading is for anyone who can see the project (the route's project boundary decides which);
 * changing the list needs `project.edit`, like the places it points at. Every change is audited with ids only.
 */
export interface PlaceFlowDto { id: string; fromPlaceId: string; from: string; toPlaceId: string; to: string; what: string; quantity: number; unit: string; note?: string }

const dto = (f: StoredPlaceFlow, name: (id: string) => string): PlaceFlowDto => ({ id: f.id, fromPlaceId: f.fromPlaceId, from: name(f.fromPlaceId), toPlaceId: f.toPlaceId, to: name(f.toPlaceId), what: f.what, quantity: f.quantity, unit: f.unit, ...(f.note ? { note: f.note } : {}) });

export class ListPlaceFlowsHandler {
  constructor(private readonly flows: IPlaceFlowRepository, private readonly places: IPlaceRepository) {}
  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ flows: PlaceFlowDto[]; canEdit: boolean; limit: number }, DomainError>> {
    if (!canView(ctx)) return err(DomainError.forbidden("You cannot see movements between places"));
    const [listed, all] = await Promise.all([this.flows.listByProject(ctx.tenant.tenantId, projectId), loadAll(this.places, ctx, true)]);
    if (!listed.ok) return listed;
    if (!all.ok) return all;
    const name = (id: string): string => (all.value.registry.pathLabel(id) || all.value.stored.find((p) => p.id === id)?.name) ?? "A place";
    return ok({ flows: listed.value.map((f) => dto(f, name)), canEdit: canEdit(ctx), limit: FLOW_LIMITS.perProject });
  }
}

export class AddPlaceFlowHandler {
  constructor(private readonly ids: IIdGenerator, private readonly flows: IPlaceFlowRepository, private readonly places: IPlaceRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}
  async handle(ctx: AuthenticatedContext, projectId: string, input: AddPlaceFlowInput): Promise<Result<PlaceFlowDto, DomainError>> {
    if (!canEdit(ctx)) return err(DomainError.forbidden("You cannot change movements between places"));
    const [existing, all] = await Promise.all([this.flows.listByProject(ctx.tenant.tenantId, projectId), loadAll(this.places, ctx, false)]);
    if (!existing.ok) return existing;
    if (!all.ok) return all;
    const live = new Set(all.value.stored.filter((p) => !p.archived && p.archivedAt === undefined).map((p) => p.id));
    const checked = checkPlaceFlow(input, live, existing.value.length);
    if (!checked.ok) return err(DomainError.validation(checked.problem));
    const flow: StoredPlaceFlow = { id: this.ids.generate(), tenantId: ctx.tenant.tenantId, projectId, ...checked.value, createdById: ctx.tenant.userId, createdAt: this.clock.now() };
    const saved = await this.flows.create(flow);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place_flow.added", entityType: "place_flow", entityId: flow.id, projectId });
    const name = (id: string): string => all.value.registry.pathLabel(id) || "A place";
    return ok(dto(flow, name));
  }
}

export class RemovePlaceFlowHandler {
  constructor(private readonly flows: IPlaceFlowRepository, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, projectId: string, flowId: string): Promise<Result<void, DomainError>> {
    if (!canEdit(ctx)) return err(DomainError.forbidden("You cannot change movements between places"));
    const r = await this.flows.delete(flowId, ctx.tenant.tenantId, projectId);
    if (!r.ok) return r;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place_flow.removed", entityType: "place_flow", entityId: flowId, projectId });
    return ok(undefined);
  }
}
