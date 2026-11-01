import type { ApplyPlan, ProjectDraft, Result, SetupAreaKey, SetupProblem } from "@donordesk/domain";
import { DomainError, blockingProblems, checkProposal, linkProposal, planApply, projectDraftFromProposal, proposeCodes } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { ISetupAreaApplier, ISetupProposalRepository } from "../../ports/project-setup.js";
import { appliersByArea } from "./apply-registry.js";
import { assertProposalAccess } from "./proposal-state.js";

export interface SetupApplyPreviewView {
  plan: ApplyPlan;
  /** What each area's ordinary handler will be given, and the items left out with the reason. */
  areas: Array<{ area: SetupAreaKey; items: number; notes: string[] }>;
  /** The project as it will be created, from the accepted facts, plus the required fields the person must still fill. */
  draft: ProjectDraft;
  missing: string[];
  /** Hard problems refuse Apply; soft ones are shown. */
  blocking: SetupProblem[];
  problems: SetupProblem[];
}

/** What Apply would do (Phase 36.3). Saves nothing: it runs the pure planning and each applier's dry run. */
export class PreviewSetupApplyHandler {
  constructor(
    private readonly proposals: ISetupProposalRepository,
    private readonly appliers: ReadonlyArray<ISetupAreaApplier>,
    private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string, selected: Readonly<Partial<Record<SetupAreaKey, boolean>>>): Promise<Result<SetupApplyPreviewView, DomainError>> {
    const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, stored.value, this.clock.now());
    if (!access.ok) return access;
    const proposal = linkProposal(proposeCodes(stored.value.proposal));
    const plan = planApply(proposal, selected);
    const byArea = appliersByArea(this.appliers);
    const areas: SetupApplyPreviewView["areas"] = [];
    for (const step of plan.steps) {
      const applier = byArea.get(step.area);
      if (!applier) return { ok: false, error: DomainError.validation(`No applier is registered for ${step.area}.`) };
      const dry = await applier.dryRun({ auth: ctx, proposalId: id }, proposal);
      if (!dry.ok) return dry;
      areas.push({ area: step.area, ...dry.value });
    }
    const problems = checkProposal(proposal);
    const { draft, missing } = projectDraftFromProposal(proposal);
    return { ok: true, value: { plan, areas, draft, missing, blocking: blockingProblems(problems), problems } };
  }
}
