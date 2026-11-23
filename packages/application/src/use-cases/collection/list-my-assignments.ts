import { DomainError, PlaceRegistry, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICollectionAssignmentRepository, ICollectionFormRepository } from "../../ports/collection.js";
import type { IPlaceRepository } from "../../ports/places.js";
import { can, fail, ok } from "./assessment-common.js";
import type { AssignmentDto } from "./list-facility-assignments.js";

/** The facilities given to the signed-in person that are not finished, with the form each belongs to. Always the caller's own. */
export class ListMyAssignmentsHandler {
  constructor(private readonly assignments: Pick<ICollectionAssignmentRepository, "listForAssignee">, private readonly forms: Pick<ICollectionFormRepository, "findById">, private readonly places: Pick<IPlaceRepository, "list">) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<AssignmentDto[], DomainError>> {
    if (!can(ctx, "collection.submit")) return fail(DomainError.forbidden("You cannot fill forms"));
    const mine = await this.assignments.listForAssignee(ctx.tenant.userId, ctx.tenant.tenantId, ["TO_DO", "IN_PROGRESS"]);
    if (!mine.ok) return mine;
    const all = await this.places.list(ctx.tenant.tenantId, { includeArchived: true });
    if (!all.ok) return all;
    const registry = new PlaceRegistry(all.value.map(({ tenantId: _t, createdById: _c, archivedAt: _a, ...record }) => record));
    const out: AssignmentDto[] = [];
    for (const a of mine.value) {
      const form = await this.forms.findById(a.formId, ctx.tenant.tenantId);
      if (!form.ok || !form.value || form.value.status !== "PUBLISHED") continue;
      out.push({
        id: a.id, formId: a.formId, formName: form.value.name, projectId: a.projectId, placeId: a.placeId, placeName: all.value.find((p) => p.id === a.placeId)?.name ?? "", path: registry.pathLabel(a.placeId),
        assigneeId: a.assigneeId, ...(a.dueOn ? { dueOn: a.dueOn } : {}), status: a.status, ...(a.reason ? { reason: a.reason } : {}),
      });
    }
    return ok(out.sort((x, y) => (x.dueOn ?? "9999").localeCompare(y.dueOn ?? "9999") || x.placeName.localeCompare(y.placeName)));
  }
}
