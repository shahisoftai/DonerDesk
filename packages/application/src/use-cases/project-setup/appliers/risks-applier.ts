import { ok, riskInputs, type DomainError, type ProjectSetupProposal, type Result } from "@donordesk/domain";
import type { ISetupAreaApplier, SetupApplyContext, SetupApplyOutcome, SetupApplyPreview } from "../../../ports/project-setup.js";
import type { SetupRiskWriter } from "../../../ports/project-setup-apply.js";

/** Risks through the ordinary risk handler; one with the same title already on the project is not raised again. */
export class RisksApplier implements ISetupAreaApplier {
  readonly area = "RISKS" as const;
  constructor(private readonly risks: SetupRiskWriter) {}
  async dryRun(_ctx: SetupApplyContext, p: ProjectSetupProposal): Promise<Result<SetupApplyPreview, DomainError>> {
    const r = riskInputs(p);
    return ok({ items: r.inputs.length, notes: r.notes });
  }
  async apply(ctx: SetupApplyContext, projectId: string, p: ProjectSetupProposal): Promise<Result<SetupApplyOutcome, DomainError>> {
    const { inputs, notes } = riskInputs(p);
    const existing = await this.risks.list(ctx.auth, projectId);
    if (!existing.ok) return existing;
    const titles = new Set(existing.value.map((r) => r.title.trim().toLowerCase()));
    let created = 0;
    let skipped = 0;
    for (const input of inputs) {
      if (titles.has(input.title.trim().toLowerCase())) {
        skipped += 1;
        continue;
      }
      const r = await this.risks.create(ctx.auth, projectId, input);
      if (!r.ok) return r;
      titles.add(input.title.trim().toLowerCase());
      created += 1;
    }
    return ok({ created, skipped, notes });
  }
}
