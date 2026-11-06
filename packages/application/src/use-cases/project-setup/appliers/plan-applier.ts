import { err, DomainError, ok, workPlanSheet, type ProjectSetupProposal, type Result } from "@donordesk/domain";
import type { ISetupAreaApplier, SetupApplyContext, SetupApplyOutcome, SetupApplyPreview } from "../../../ports/project-setup.js";
import type { SetupWorkPlanImporter } from "../../../ports/project-setup-apply.js";

/** Planned activities through the ordinary work-plan import: any row it cannot read blocks the area and is named. */
export class PlanApplier implements ISetupAreaApplier {
  readonly area = "PLAN" as const;
  constructor(private readonly importer: SetupWorkPlanImporter) {}
  async dryRun(_ctx: SetupApplyContext, p: ProjectSetupProposal): Promise<Result<SetupApplyPreview, DomainError>> {
    const s = workPlanSheet(p);
    return ok({ items: s.rows, notes: s.notes });
  }
  async apply(ctx: SetupApplyContext, projectId: string, p: ProjectSetupProposal): Promise<Result<SetupApplyOutcome, DomainError>> {
    const s = workPlanSheet(p);
    if (s.rows === 0) return ok({ created: 0, skipped: 0, notes: s.notes });
    const r = await this.importer.handle(ctx.auth, projectId, { apply: true, text: s.text, sourceName: "Project document" });
    if (!r.ok) return r;
    if (r.value.problems.length > 0) return err(DomainError.validation(`The work plan could not be created: ${r.value.problems.join("; ")}`));
    return ok({ created: r.value.created, skipped: r.value.skipped, notes: [...s.notes, ...r.value.warnings] });
  }
}
