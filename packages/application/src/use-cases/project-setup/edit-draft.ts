import type { Result, SetupOperation } from "@donordesk/domain";
import { DomainError, applyOperation } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { ISetupProposalRepository } from "../../ports/project-setup.js";
import { draftOf, type SetupDraftView } from "./draft-view.js";
import type { DraftViewer } from "./draft-viewer.js";
import { assertProposalAccess } from "./proposal-state.js";

/** A save can lose a race with a running extraction touching the same row; the edit is applied again to what is stored now. */
const SAVE_ATTEMPTS = 3;

/**
 * One wizard edit (Phase 38): reads the stored decisions, applies the pure operation, and writes only the decisions — never
 * the proposal, so a running extraction cannot lose the edit and the edit cannot lose its results. The audit records the
 * operation's kind, never its values.
 */
export class EditSetupDraftHandler {
  constructor(private readonly proposals: ISetupProposalRepository, private readonly audit: IAuditLogger, private readonly clock: IClock, private readonly viewer: DraftViewer) {}

  async handle(ctx: AuthenticatedContext, id: string, op: SetupOperation): Promise<Result<SetupDraftView, DomainError>> {
    for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
      const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
      if (!stored.ok) return stored;
      if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
      const access = assertProposalAccess(ctx, stored.value, this.clock.now());
      if (!access.ok) return access;
      if (stored.value.createdById !== ctx.tenant.userId) return { ok: false, error: DomainError.forbidden("Only the person who started this setup can change it") };
      if (stored.value.status !== "READY" && stored.value.status !== "PARTIAL" && stored.value.status !== "EXTRACTING") {
        return { ok: false, error: DomainError.validation("This setup can no longer be changed.") };
      }
      const result = applyOperation(draftOf(stored.value), op);
      if (!result.ok) return { ok: false, error: DomainError.validation(result.reason) };
      const saved = await this.proposals.updateExtras(id, ctx.tenant.tenantId, result.draft.extras, stored.value.updatedAt);
      if (!saved.ok) return saved;
      if (!saved.value) continue;
      await this.audit.record({
        tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "setup.draft.edited",
        entityType: "project_setup_proposal", entityId: id, newValue: JSON.stringify({ op: op.kind }),
      });
      const fresh = await this.proposals.findById(id, ctx.tenant.tenantId);
      if (!fresh.ok) return fresh;
      return fresh.value ? this.viewer.describe(fresh.value) : { ok: false, error: DomainError.notFound("Setup proposal", id) };
    }
    return { ok: false, error: new DomainError("CONFLICT", "The page was saving something else at the same time. Try again.") };
  }
}
