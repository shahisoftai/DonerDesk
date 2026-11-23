import { DomainError, computeScore, type Result, type ScoreResult } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICollectionFormRepository, ICollectionRecordRepository } from "../../ports/collection.js";
import { can, fail, loadForm, ok } from "./assessment-common.js";

/** The score of a record, worked out now from its stored answers and the form's rules (so a corrected rule is read at once). */
export class GetRecordScoreHandler {
  constructor(private readonly forms: Pick<ICollectionFormRepository, "findById">, private readonly records: Pick<ICollectionRecordRepository, "findById">) {}

  async handle(ctx: AuthenticatedContext, recordId: string): Promise<Result<ScoreResult, DomainError>> {
    if (!can(ctx, "indicator.update") && !can(ctx, "indicator.verify")) return fail(DomainError.forbidden("You cannot see collected records"));
    const found = await this.records.findById(recordId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return fail(DomainError.notFound("Record", recordId));
    const form = await loadForm(this.forms, found.value.formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    if (!form.value.definition.score) return fail(DomainError.validation("This form has no score rules."));
    return ok(computeScore(form.value.definition.score, found.value.answers));
  }
}
