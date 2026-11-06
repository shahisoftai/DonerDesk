import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IStorage } from "../../ports/infrastructure.js";
import { driveFileIdsOf, type ISetupDocumentStore } from "../../ports/project-setup.js";
import type { ISetupProposalRepository, ISetupRunRepository } from "../../ports/project-setup.js";
import { assertProposalAccess } from "./proposal-state.js";

/**
 * Throws a proposal away: the stored document is deleted from storage first, then the proposal and its runs. Audited; the
 * audit carries only the decision, never the document.
 */
export class DiscardSetupProposalHandler {
  constructor(
    private readonly proposals: ISetupProposalRepository,
    private readonly runs: ISetupRunRepository,
    /** Only for a proposal made before documents moved to the organisation's Drive: its file is in server storage. */
    private readonly legacyStorage: IStorage,
    private readonly documents: ISetupDocumentStore,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, stored.value, this.clock.now());
    if (!access.ok) return access;
    if (stored.value.status === "EXTRACTING") {
      return { ok: false, error: DomainError.validation("The document is still being read. Wait for it to finish, then discard.") };
    }
    const proposal = stored.value;
    // The document goes first: if the delete below fails, the source is already gone, which is the safe direction. A document
    // in the organisation's Drive is removed only while it is still in the staging folder; once a project was created from it,
    // it lives in that project's folder and is the organisation's record, so discarding the proposal never deletes it.
    const fileIds = driveFileIdsOf(proposal.sourceStorageKey);
    // A wizard project started with no documents has no source at all.
    if (fileIds.length === 0) { if (proposal.sourceStorageKey) await this.legacyStorage.remove(proposal.sourceStorageKey); }
    else if (!proposal.appliedProjectId) for (const fileId of fileIds) await this.documents.removeStaged(ctx.tenant.tenantId, fileId);
    const runsRemoved = await this.runs.deleteByProposal(id, ctx.tenant.tenantId);
    if (!runsRemoved.ok) return runsRemoved;
    const deleted = await this.proposals.delete(id, ctx.tenant.tenantId);
    if (!deleted.ok) return deleted;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "setup.proposal.discarded",
      entityType: "project_setup_proposal", entityId: id,
    });
    return { ok: true, value: undefined };
  }
}
