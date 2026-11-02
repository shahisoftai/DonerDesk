import type { Result } from "@donordesk/domain";
import { DomainError, SETUP_REQUIREMENTS, evaluateRequirements, gapInbox, signOffDraft } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { ISetupProposalRepository } from "../../ports/project-setup.js";
import { draftOf, type SetupDraftView } from "./draft-view.js";
import type { DraftViewer } from "./draft-viewer.js";
import { assertProposalAccess } from "./proposal-state.js";

/**
 * The person who started the setup signs it off (Phase 38.9). The server records who signed and when from the session, never
 * from the request, together with a fingerprint of exactly what was signed: any later change makes the sign-off stale. It is
 * refused while anything is still open. Nothing here starts the project.
 */
export class SignOffSetupHandler {
  constructor(private readonly proposals: ISetupProposalRepository, private readonly audit: IAuditLogger, private readonly clock: IClock, private readonly viewer: DraftViewer) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<SetupDraftView, DomainError>> {
    const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, stored.value, this.clock.now());
    if (!access.ok) return access;
    if (stored.value.createdById !== ctx.tenant.userId) return { ok: false, error: DomainError.forbidden("Only the person who started this setup can sign it off") };
    if (stored.value.status !== "READY" && stored.value.status !== "PARTIAL") return { ok: false, error: DomainError.validation("This setup cannot be signed off now.") };
    const draft = draftOf(stored.value);
    const open = gapInbox(evaluateRequirements(draft, SETUP_REQUIREMENTS)).length;
    const signed = signOffDraft(draft, ctx.tenant.userId, this.clock.now().toISOString(), open);
    if (!signed.ok) return { ok: false, error: DomainError.validation(signed.reason) };
    const saved = await this.proposals.updateExtras(id, ctx.tenant.tenantId, signed.draft.extras, stored.value.updatedAt);
    if (!saved.ok) return saved;
    if (!saved.value) return { ok: false, error: new DomainError("CONFLICT", "Something changed while you were signing off. Look again and sign off once more.") };
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "setup.signed-off", entityType: "project_setup_proposal", entityId: id });
    const fresh = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!fresh.ok) return fresh;
    return fresh.value ? this.viewer.describe(fresh.value) : { ok: false, error: DomainError.notFound("Setup proposal", id) };
  }
}
