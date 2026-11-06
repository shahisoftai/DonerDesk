import { DomainError, SETUP_AREA_KEYS, type Result, type SetupDocumentKind } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { ISetupProposalRepository } from "../../ports/project-setup.js";
import type { RerunSetupAreaHandler } from "./rerun-area.js";
import { assertProposalAccess } from "./proposal-state.js";

/**
 * A person says what one of the documents is (Phase 37.6) — "this is the budget", "this is the work plan" — or puts the
 * reading back (null). The choice is saved on the proposal, then every part is read again (each in the background, like
 * "Read this part again"), because which document a part reads from has changed.
 */
export class SetSetupDocumentKindHandler {
  constructor(
    private readonly proposals: ISetupProposalRepository,
    private readonly rerun: Pick<RerunSetupAreaHandler, "handle">,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string, documentId: string, kind: SetupDocumentKind | null): Promise<Result<{ rereading: string[] }, DomainError>> {
    const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, stored.value, this.clock.now());
    if (!access.ok) return access;
    if (stored.value.createdById !== ctx.tenant.userId) return { ok: false, error: DomainError.forbidden("Only the person who started this proposal can review it") };
    if (stored.value.status !== "READY") return { ok: false, error: DomainError.validation("Only a proposal that is ready for review can be read again.") };
    const sources = stored.value.proposal.sources ?? [];
    if (!sources.some((s) => s.documentId === documentId)) return { ok: false, error: DomainError.validation("That document is not part of this proposal.") };
    const next = sources.map((s) => {
      if (s.documentId !== documentId) return s;
      const { override: _old, ...rest } = s;
      return kind ? { ...rest, override: kind } : rest;
    });
    const saved = await this.proposals.update({ ...stored.value, proposal: { ...stored.value.proposal, sources: next } }, stored.value.updatedAt);
    if (!saved.ok) return saved;
    if (saved.value === false) return { ok: false, error: new DomainError("CONFLICT", "Someone saved a decision since you opened this proposal. Reload and try again.") };
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "setup.document.kind_set",
      entityType: "project_setup_proposal", entityId: id, newValue: JSON.stringify({ documentId, kind }),
    });
    const rereading: string[] = [];
    for (const area of SETUP_AREA_KEYS) {
      const started = await this.rerun.handle(ctx, id, area);
      if (started.ok) rereading.push(area);
    }
    return { ok: true, value: { rereading } };
  }
}
