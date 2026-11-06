import type { DomainError, Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { ISetupProposalRepository, StoredSetupProposal } from "../../ports/project-setup.js";

/** The person's own proposals, newest first (a proposal is started by one person; managers open one by link). */
export class ListSetupProposalsHandler {
  constructor(private readonly proposals: ISetupProposalRepository, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<StoredSetupProposal[], DomainError>> {
    const list = await this.proposals.listForCreator(ctx.tenant.tenantId, ctx.tenant.userId);
    if (!list.ok) return list;
    const now = this.clock.now();
    // An expired proposal's document is deleted; it stays listed as FAILED so the person knows it is dead, never reusable.
    return { ok: true, value: list.value.map((p) => (p.expiresAt.getTime() < now.getTime() ? { ...p, status: "FAILED" as const } : p)) };
  }
}
