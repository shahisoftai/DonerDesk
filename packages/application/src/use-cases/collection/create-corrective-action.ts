import { DomainError, type Result } from "@donordesk/domain";
import type { CorrectiveActionInput, CreateRiskInput, CreateTaskInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { ICollectionFormRepository, ICollectionRecordRepository } from "../../ports/collection.js";
import type { IPlaceRepository } from "../../ports/places.js";
import { can, fail, loadForm, ok } from "./assessment-common.js";

/**
 * From a low-scoring item to a request or a problem (Phase 62.7), one click and never automatic. It goes through the ordinary request or
 * problem handlers, so their permissions, notifications and audit apply; the text names the facility and the item in plain words.
 */
export class CreateCorrectiveActionHandler {
  constructor(
    private readonly forms: Pick<ICollectionFormRepository, "findById">, private readonly records: Pick<ICollectionRecordRepository, "findById">, private readonly places: Pick<IPlaceRepository, "findById">,
    private readonly tasks: { handle(ctx: AuthenticatedContext, projectId: string, input: CreateTaskInput): Promise<Result<{ id: string }, DomainError>> },
    private readonly risks: { handle(ctx: AuthenticatedContext, projectId: string, input: CreateRiskInput): Promise<Result<{ id: string }, DomainError>> },
  ) {}

  async handle(ctx: AuthenticatedContext, recordId: string, input: CorrectiveActionInput): Promise<Result<{ kind: "TASK" | "RISK"; id: string }, DomainError>> {
    if (!can(ctx, "indicator.verify") && !can(ctx, "project.edit")) return fail(DomainError.forbidden("You cannot raise follow-up actions from an assessment"));
    const found = await this.records.findById(recordId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return fail(DomainError.notFound("Record", recordId));
    const form = await loadForm(this.forms, found.value.formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    const place = found.value.placeId ? await this.places.findById(found.value.placeId, ctx.tenant.tenantId) : undefined;
    const where = place?.ok && place.value ? place.value.name : "the facility";
    const title = `${where}: ${input.label}`.slice(0, 280);
    if (input.kind === "TASK") {
      if (!input.assigneeId) return fail(DomainError.validation("Choose who is asked.", { field: "assigneeId" }));
      const r = await this.tasks.handle(ctx, found.value.projectId, { kind: "OTHER", title, assigneeId: input.assigneeId, ...(input.dueOn ? { dueDate: input.dueOn } : {}), note: `From the assessment "${form.value.name}".`, urgent: false });
      return r.ok ? ok({ kind: "TASK", id: r.value.id }) : r;
    }
    const r = await this.risks.handle(ctx, found.value.projectId, { kind: "PROBLEM", title, seriousness: "MEDIUM", action: "" });
    return r.ok ? ok({ kind: "RISK", id: r.value.id }) : r;
  }
}
