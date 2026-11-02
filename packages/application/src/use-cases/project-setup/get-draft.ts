import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
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
    return this.viewer.describe(stored.value);
  }
}
