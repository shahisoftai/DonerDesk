import { budgetNotApplied, fundingInputs, ok, err, DomainError, type ProjectSetupProposal, type Result } from "@donordesk/domain";
import type { ISetupAreaApplier, SetupApplyContext, SetupApplyOutcome, SetupApplyPreview } from "../../../ports/project-setup.js";
import type { SetupFundingWriter } from "../../../ports/project-setup-apply.js";

/**
 * Funding through the finance register's own handlers: the source is found by name (or added), the allocation is dated at
 * the project's start. An allocation already recorded (same source, amount, currency) is not recorded twice. Budget lines
 * stay in the review: they need a planned activity to sit under.
 */
export class FundingBudgetApplier implements ISetupAreaApplier {
  readonly area = "FUNDING_BUDGET" as const;
  constructor(private readonly finance: SetupFundingWriter) {}
  async dryRun(_ctx: SetupApplyContext, p: ProjectSetupProposal): Promise<Result<SetupApplyPreview, DomainError>> {
    const f = fundingInputs(p);
    return ok({ items: f.inputs.length, notes: [...f.notes, ...budgetNotApplied(p)] });
  }
  async apply(ctx: SetupApplyContext, projectId: string, p: ProjectSetupProposal): Promise<Result<SetupApplyOutcome, DomainError>> {
    const { inputs, notes } = fundingInputs(p);
    const all = [...notes, ...budgetNotApplied(p)];
    if (inputs.length === 0) return ok({ created: 0, skipped: 0, notes: all });
    const [start, sources, existing] = await Promise.all([this.finance.projectStart(ctx.auth, projectId), this.finance.sources(ctx.auth), this.finance.existing(ctx.auth, projectId)]);
    if (!start.ok) return start;
    if (!sources.ok) return sources;
    if (!existing.ok) return existing;
    if (!start.value) return err(DomainError.validation("The project has no start date to date its funding."));
    const byName = new Map(sources.value.filter((s) => !s.archived).map((s) => [s.name.trim().toLowerCase(), s.id]));
    let created = 0;
    let skipped = 0;
    for (const input of inputs) {
      const key = input.sourceName.trim().toLowerCase();
      let sourceId = byName.get(key);
      if (!sourceId) {
        const made = await this.finance.createSource(ctx.auth, input.sourceName);
        if (!made.ok) return made;
        sourceId = made.value.id;
        byName.set(key, sourceId);
      }
      const repeat = existing.value.some((e) => e.fundingSourceId === sourceId && e.currency === input.currency && Number(e.amountText) === Number(input.amount));
      if (repeat) {
        skipped += 1;
        continue;
      }
      const r = await this.finance.add(ctx.auth, projectId, { fundingSourceId: sourceId, date: start.value, amount: input.amount, currency: input.currency, note: "From the project document" });
      if (!r.ok) return r;
      created += 1;
    }
    return ok({ created, skipped, notes: all });
  }
}
