import { DomainError, prefillFromLast, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICollectionFormRepository, ICollectionRecordRepository } from "../../ports/collection.js";
import { can, fail, loadForm, ok } from "./assessment-common.js";

/**
 * What the last accepted assessment of this facility already says about the facts the form marks as carried forward (year established,
 * catchment population…). Only those fields, only from an accepted record, and returned apart so the screen shows where they came from.
 */
export class GetAssessmentPrefillHandler {
  constructor(private readonly forms: Pick<ICollectionFormRepository, "findById">, private readonly records: Pick<ICollectionRecordRepository, "listByPlace">) {}

  async handle(ctx: AuthenticatedContext, formId: string, placeId: string): Promise<Result<{ values: Record<string, unknown>; carried: string[]; fromVisit?: number; fromDay?: string }, DomainError>> {
    if (!can(ctx, "collection.submit")) return fail(DomainError.forbidden("You cannot fill forms"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    const before = await this.records.listByPlace(formId, placeId, ctx.tenant.tenantId);
    if (!before.ok) return before;
    const last = [...before.value].reverse().find((r) => r.status === "ACCEPTED");
    if (!last) return ok({ values: {}, carried: [] });
    const p = prefillFromLast(form.value.definition, last.answers);
    return ok({ ...p, ...(last.visitNo ? { fromVisit: last.visitNo } : {}), fromDay: last.submittedOn });
  }
}
