import { DomainError, PlaceRegistry, coverageByArea, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { AssignmentState, ICollectionAssignmentRepository, ICollectionFormRepository } from "../../ports/collection.js";
import type { IPlaceRepository } from "../../ports/places.js";
import { can, fail, loadForm, ok } from "./assessment-common.js";

export interface AssignmentDto { id: string; formId: string; formName?: string; projectId: string; placeId: string; placeName: string; path: string; assigneeId: string; dueOn?: string; status: AssignmentState; reason?: string; recordId?: string }
export interface CoverageDto { areaId: string; area: string; assigned: number; started: number; done: number; notVisited: number; toDo: number }

/** The facilities of a form with who has each, and how far the round has got by area (the district a facility sits in). */
export class ListFacilityAssignmentsHandler {
  constructor(private readonly forms: Pick<ICollectionFormRepository, "findById">, private readonly assignments: Pick<ICollectionAssignmentRepository, "listByForm">, private readonly places: Pick<IPlaceRepository, "list">) {}

  async handle(ctx: AuthenticatedContext, formId: string, areaLevel = 2): Promise<Result<{ assignments: AssignmentDto[]; coverage: CoverageDto[] }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see assignments"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    const [list, all] = await Promise.all([this.assignments.listByForm(formId, ctx.tenant.tenantId), this.places.list(ctx.tenant.tenantId, { includeArchived: true })]);
    if (!list.ok) return list;
    if (!all.ok) return all;
    const registry = new PlaceRegistry(all.value.map(({ tenantId: _t, createdById: _c, archivedAt: _a, ...record }) => record));
    const areaOf = (placeId: string): string | undefined => {
      let p = all.value.find((x) => x.id === placeId);
      for (let i = 0; p && i < 8; i += 1) { if (p.adminLevel === areaLevel) return p.id; p = p.parentId ? all.value.find((x) => x.id === p!.parentId) : undefined; }
      return undefined;
    };
    const name = (id: string): string => all.value.find((p) => p.id === id)?.name ?? "";
    return ok({
      assignments: list.value.map((a) => ({
        id: a.id, formId: a.formId, projectId: a.projectId, placeId: a.placeId, placeName: name(a.placeId), path: registry.pathLabel(a.placeId), assigneeId: a.assigneeId,
        ...(a.dueOn ? { dueOn: a.dueOn } : {}), status: a.status, ...(a.reason ? { reason: a.reason } : {}), ...(a.recordId ? { recordId: a.recordId } : {}),
      })),
      coverage: coverageByArea(list.value, areaOf).map((r) => ({ ...r, area: r.areaId ? name(r.areaId) : "No district" })),
    });
  }
}
