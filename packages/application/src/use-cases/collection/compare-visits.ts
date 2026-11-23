import { DomainError, compareVisits, type Result, type VisitComparison } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICollectionFormRepository, ICollectionRecordRepository } from "../../ports/collection.js";
import { can, fail, loadForm, ok } from "./assessment-common.js";

/** A follow-up visit against an earlier one for the same facility (by default the visit before it), item by item, under the form's own score rules. */
export class CompareVisitsHandler {
  constructor(private readonly forms: Pick<ICollectionFormRepository, "findById">, private readonly records: Pick<ICollectionRecordRepository, "findById" | "listByPlace">) {}

  async handle(ctx: AuthenticatedContext, recordId: string, againstId?: string): Promise<Result<VisitComparison & { beforeVisit?: number; afterVisit?: number }, DomainError>> {
    if (!can(ctx, "indicator.update") && !can(ctx, "indicator.verify")) return fail(DomainError.forbidden("You cannot see collected records"));
    const found = await this.records.findById(recordId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const after = found.value;
    if (!after) return fail(DomainError.notFound("Record", recordId));
    const form = await loadForm(this.forms, after.formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    if (!form.value.definition.score) return fail(DomainError.validation("This form has no score rules, so visits cannot be compared."));
    if (!after.placeId) return fail(DomainError.validation("This record is not about a facility, so there is no earlier visit."));
    const visits = await this.records.listByPlace(after.formId, after.placeId, ctx.tenant.tenantId);
    if (!visits.ok) return visits;
    const earlier = againstId ? visits.value.find((r) => r.id === againstId) : [...visits.value].filter((r) => r.createdAt < after.createdAt && r.status !== "REJECTED").pop();
    if (!earlier) return fail(DomainError.notFound("Earlier visit", againstId ?? "none"));
    const result = compareVisits(form.value.definition.score, earlier.answers, after.answers);
    return ok({ ...result, ...(earlier.visitNo ? { beforeVisit: earlier.visitNo } : {}), ...(after.visitNo ? { afterVisit: after.visitNo } : {}) });
  }
}
