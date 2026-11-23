import { DomainError, Permissions, type Result } from "@donordesk/domain";
import type { AssignFacilitiesInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ICollectionAssignmentRepository, ICollectionFormRepository, StoredCollectionAssignment } from "../../ports/collection.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IPersonNotifier } from "../../ports/reminders.js";
import type { IProjectRoster } from "../../ports/tasks.js";
import { can, fail, loadForm, ok } from "./assessment-common.js";

/**
 * Gives facilities to assessors for a form (Phase 62.5). The person must be an active member of the project who may submit records, the
 * place must be a live facility (for a facility form), and a facility already done is left as it is. They are told once, in the app.
 */
export class AssignFacilitiesHandler {
  constructor(
    private readonly ids: IIdGenerator, private readonly forms: Pick<ICollectionFormRepository, "findById">, private readonly assignments: ICollectionAssignmentRepository,
    private readonly places: Pick<IPlaceRepository, "list">, private readonly roster: IProjectRoster, private readonly notify: IPersonNotifier, private readonly audit: IAuditLogger, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, formId: string, input: AssignFacilitiesInput): Promise<Result<{ assigned: number; skippedDone: number }, DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("You cannot assign facilities"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    const subject = form.value.definition.subject ?? "NONE";
    if (subject === "NONE") return fail(DomainError.validation("This form is not about a facility, so there is nothing to assign."));
    if (form.value.status !== "PUBLISHED") return fail(DomainError.conflict("Publish the form before assigning facilities."));

    const [places, members, existing] = await Promise.all([this.places.list(ctx.tenant.tenantId), this.roster.activeMembers(form.value.projectId, ctx.tenant.tenantId), this.assignments.listByForm(formId, ctx.tenant.tenantId)]);
    if (!places.ok) return places;
    if (!members.ok) return members;
    if (!existing.ok) return existing;
    const live = new Map(places.value.filter((p) => !p.archivedAt).map((p) => [p.id, p]));
    const doneAlready = new Set(existing.value.filter((a) => a.status === "DONE").map((a) => a.placeId));
    const byPlace = new Map(existing.value.map((a) => [a.placeId, a]));

    const now = this.clock.now();
    const items: StoredCollectionAssignment[] = [];
    let skippedDone = 0;
    for (const a of input.assignments) {
      const place = live.get(a.placeId);
      if (!place) return fail(DomainError.validation("One of the places is not in the list of places."));
      if (subject === "FACILITY" && place.facility !== true) return fail(DomainError.validation(`${place.name} is not marked as a facility.`));
      const member = members.value.find((m) => m.userId === a.assigneeId);
      if (!member) return fail(DomainError.validation("Only an active member of this project can be given facilities.", { field: "assigneeId" }));
      if (!Permissions.can(member.role, "collection.submit")) return fail(DomainError.validation("That person's role cannot submit records. Choose someone else.", { field: "assigneeId" }));
      if (doneAlready.has(a.placeId)) { skippedDone += 1; continue; }
      const before = byPlace.get(a.placeId);
      items.push({
        id: before?.id ?? this.ids.generate(), tenantId: ctx.tenant.tenantId, formId, projectId: form.value.projectId, placeId: a.placeId, assigneeId: a.assigneeId,
        ...(a.dueOn ? { dueOn: a.dueOn } : {}), status: before?.status === "IN_PROGRESS" ? "IN_PROGRESS" : "TO_DO", createdById: before?.createdById ?? ctx.tenant.userId, createdAt: before?.createdAt ?? now, updatedAt: now,
      });
    }
    if (items.length === 0) return ok({ assigned: 0, skippedDone });
    const saved = await this.assignments.upsertMany(items);
    if (!saved.ok) return saved;
    const perPerson = new Map<string, number>();
    for (const i of items) perPerson.set(i.assigneeId, (perPerson.get(i.assigneeId) ?? 0) + 1);
    for (const [recipientId, count] of perPerson) {
      await this.notify.send({ tenantId: ctx.tenant.tenantId, recipientId, type: "ASSIGNMENT", urgent: false, title: "Facilities to assess", message: `${count} ${count === 1 ? "facility" : "facilities"} to assess for "${form.value.name}".`, relatedEntityType: "collection_form", relatedEntityId: formId });
    }
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "collection.assignment.assigned", entityType: "collection_form", entityId: formId, projectId: form.value.projectId, newValue: JSON.stringify({ count: items.length }) });
    return ok({ assigned: items.length, skippedDone });
  }
}
