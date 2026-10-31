import { ok, type DomainError, type ProjectSetupProposal, type Result } from "@donordesk/domain";
import type { ISetupAreaApplier, SetupApplyContext, SetupApplyOutcome, SetupApplyPreview } from "../../../ports/project-setup.js";

/**
 * The facts are written when the project is created (`ApplySetupProposalHandler`, with the person's completed draft); this
 * step only records that, so the registry stays exhaustive and the apply order still starts with the facts.
 */
export class FactsApplier implements ISetupAreaApplier {
  readonly area = "FACTS" as const;
  async dryRun(_ctx: SetupApplyContext, _p: ProjectSetupProposal): Promise<Result<SetupApplyPreview, DomainError>> {
    return ok({ items: 1, notes: [] });
  }
  async apply(): Promise<Result<SetupApplyOutcome, DomainError>> {
    return ok({ created: 0, skipped: 0, notes: [] });
  }
}
