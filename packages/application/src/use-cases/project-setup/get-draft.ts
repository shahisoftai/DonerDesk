import type { Result } from "@donordesk/domain";
import { DomainError, emptyExtras, prefillFromDocuments } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { ISetupProposalRepository } from "../../ports/project-setup.js";
import type { SetupDraftView } from "./draft-view.js";
import type { DraftViewer } from "./draft-viewer.js";
import { assertProposalAccess } from "./proposal-state.js";

/** The wizard's current state for one draft: decisions, requirements, gap inbox and per-slide progress (derived on every read). */
export class GetSetupDraftHandler {
  constructor(private readonly proposals: ISetupProposalRepository, private readonly clock: IClock, private readonly viewer: DraftViewer) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<SetupDraftView, DomainError>> {
    const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, stored.value, this.clock.now());
    if (!access.ok) return access;
    // Once the documents are read, what they state fills the wizard's empty answers (Start, reporting schedule), once.
    if (stored.value.status === "READY") {
      // A document draft has no stored extras until its first edit.
      const current = stored.value.extras ?? emptyExtras(true);
      const { draft } = prefillFromDocuments({ proposal: stored.value.proposal, extras: current });
      if (draft.extras !== current) {
        const saved = await this.proposals.updateExtras(id, ctx.tenant.tenantId, draft.extras, stored.value.updatedAt);
        if (saved.ok && saved.value) {
          const fresh = await this.proposals.findById(id, ctx.tenant.tenantId);
          if (fresh.ok && fresh.value) return this.viewer.describe(fresh.value);
        }
      }
    }
    return this.viewer.describe(stored.value);
  }
}
