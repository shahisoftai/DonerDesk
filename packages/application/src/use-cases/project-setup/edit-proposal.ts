import type { Result, Role } from "@donordesk/domain";
import { DomainError, acceptItem, checkProposal, editValue, fillNotStated, rejectItem } from "@donordesk/domain";
import type { EditSetupProposalInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { ISetupProposalRepository } from "../../ports/project-setup.js";
import { assertProposalAccess } from "./proposal-state.js";

/**
 * One review decision (accept, reject, edit, fill) applied to one item (Phase 36). Refuses a stale save: the version the
 * person was looking at must still be the stored one. The audit records the area and the operation, never the value.
 */
export class EditSetupProposalHandler {
  constructor(
    private readonly proposals: ISetupProposalRepository,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string, input: EditSetupProposalInput): Promise<Result<{ updatedAt: Date }, DomainError>> {
    const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, stored.value, this.clock.now());
    if (!access.ok) return access;
    if (stored.value.createdById !== ctx.tenant.userId) {
      return { ok: false, error: DomainError.forbidden("Only the person who started this proposal can review it") };
    }
    if (stored.value.status === "EXTRACTING") {
      return { ok: false, error: DomainError.validation("The document is still being read. Try again in a moment.") };
    }
    // A partly applied proposal stays editable: the person fixes the area that failed and applies again to resume.
    if (stored.value.status !== "READY" && stored.value.status !== "PARTIAL") {
      return { ok: false, error: DomainError.validation("Only a proposal that is ready for review, or partly applied, can be edited.") };
    }
    const ref = { area: input.area, path: input.path };
    const op = input.op;
    const result =
      op === "ACCEPT" ? acceptItem(stored.value.proposal, ref)
        : op === "REJECT" ? rejectItem(stored.value.proposal, ref)
          : op === "FILL" ? fillNotStated(stored.value.proposal, ref, input.value)
            : editValue(stored.value.proposal, ref, input.value);
    if (!result.ok) return { ok: false, error: DomainError.validation(result.reason) };
    const expected = input.expectedUpdatedAt ? new Date(input.expectedUpdatedAt) : undefined;
    if (expected && Number.isNaN(expected.getTime())) {
      return { ok: false, error: DomainError.validation("The version you opened could not be read; reload the page.") };
    }
    const next = { ...stored.value, proposal: result.proposal, problems: checkProposal(result.proposal) };
    const saved = await this.proposals.update(next, expected);
    if (!saved.ok) return saved;
    if (saved.value === false) {
      return { ok: false, error: new DomainError("CONFLICT", "Someone saved a decision since you opened this proposal. Reload and try again.") };
    }
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "setup.proposal.edited",
      entityType: "project_setup_proposal", entityId: id,
      newValue: JSON.stringify({ area: input.area, op: input.op }),
    });
    // The version the next edit must quote is the one the store now holds, read back, not the clock's time.
    const stored_ = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored_.ok) return stored_;
    return { ok: true, value: { updatedAt: stored_.value?.updatedAt ?? this.clock.now() } };
  }
}
