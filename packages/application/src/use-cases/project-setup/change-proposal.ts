import type { Result } from "@donordesk/domain";
import { DomainError, checkProposal, type ProjectSetupProposal } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { ISetupProposalRepository } from "../../ports/project-setup.js";
import type { SetupDraftView } from "./draft-view.js";
import type { DraftViewer } from "./draft-viewer.js";
import { assertProposalAccess } from "./proposal-state.js";

/** A pure edit of the proposal: the next proposal, or a sentence saying why not. */
export type ProposalChange<Op extends { kind: string }> = (proposal: ProjectSetupProposal, op: Op) => { ok: true; proposal: ProjectSetupProposal } | { ok: false; reason: string };

/**
 * One edit to the proposal itself (Phase 38.3+): the slide's own pure change is passed in, so results and places share this
 * handler instead of copying it. It saves with the version the person was looking at and is refused if someone saved since
 * (the same rule as a review decision). The decisions are not touched. The audit records the operation's kind, never its words.
 */
export class ChangeSetupProposalHandler<Op extends { kind: string }> {
  constructor(
    private readonly proposals: ISetupProposalRepository,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly change: ProposalChange<Op>,
    private readonly eventType: string,
    private readonly viewer: DraftViewer,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string, op: Op): Promise<Result<SetupDraftView, DomainError>> {
    const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, stored.value, this.clock.now());
    if (!access.ok) return access;
    if (stored.value.createdById !== ctx.tenant.userId) return { ok: false, error: DomainError.forbidden("Only the person who started this setup can change it") };
    if (stored.value.status !== "READY" && stored.value.status !== "PARTIAL") {
      return { ok: false, error: DomainError.validation("Wait until the documents have been read, then make your changes.") };
    }
    const result = this.change(stored.value.proposal, op);
    if (!result.ok) return { ok: false, error: DomainError.validation(result.reason) };
    const saved = await this.proposals.update({ ...stored.value, proposal: result.proposal, problems: checkProposal(result.proposal) }, stored.value.updatedAt);
    if (!saved.ok) return saved;
    if (!saved.value) return { ok: false, error: new DomainError("CONFLICT", "Something changed while you were editing. Reload and try again.") };
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: this.eventType,
      entityType: "project_setup_proposal", entityId: id, newValue: JSON.stringify({ op: op.kind }),
    });
    const fresh = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!fresh.ok) return fresh;
    return fresh.value ? this.viewer.describe(fresh.value) : { ok: false, error: DomainError.notFound("Setup proposal", id) };
  }
}
