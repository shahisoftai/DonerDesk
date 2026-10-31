import { ok, willApplyItem, type DomainError, type ProjectSetupProposal, type Result } from "@donordesk/domain";
import type { ISetupAreaApplier, SetupApplyContext, SetupApplyOutcome, SetupApplyPreview } from "../../../ports/project-setup.js";
import type { SetupPeriodCreator } from "../../../ports/project-setup-apply.js";

/**
 * Reporting periods come from the project's own cadence and dates (`CreateAllPeriodsHandler`), the one rule for which
 * periods exist; the document's stated cadence chose the project's reporting frequency in the draft. Periods already there
 * are not created again.
 */
export class PeriodsApplier implements ISetupAreaApplier {
  readonly area = "PERIODS" as const;
  constructor(private readonly periods: SetupPeriodCreator) {}
  async dryRun(_ctx: SetupApplyContext, p: ProjectSetupProposal): Promise<Result<SetupApplyPreview, DomainError>> {
    return ok({ items: p.periods.filter(willApplyItem).length, notes: ["Reporting periods are created from the project's dates and reporting frequency."] });
  }
  async apply(ctx: SetupApplyContext, projectId: string): Promise<Result<SetupApplyOutcome, DomainError>> {
    const r = await this.periods.handle(ctx.auth, projectId);
    return r.ok ? ok({ created: r.value.created.length, skipped: 0, notes: r.value.failed.map((f) => f.error) }) : r;
  }
}
