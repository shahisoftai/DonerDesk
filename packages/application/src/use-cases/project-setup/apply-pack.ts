import type { Result } from "@donordesk/domain";
import { DomainError, applyPack, resolvePack } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IDefaultPackSource, ISetupProposalRepository } from "../../ports/project-setup.js";
import { draftOf, type SetupDraftView } from "./draft-view.js";
import type { DraftViewer } from "./draft-viewer.js";
import { assertProposalAccess } from "./proposal-state.js";

export interface PackAppliedView {
  view: SetupDraftView;
  packLabel: string;
  /** What the pack filled, by name; empty when everything it offers was already answered. */
  filled: string[];
}

/**
 * Fills a draft's empty answers from the pack for its sector (Phase 38, decision D8: sector only, never donor). It never
 * overwrites an answer, a document's reading or a person's choice, and writes the suggested risks as undecided items. Suggested risks
 * go into the proposal and the other answers into the decisions.
 */
export class ApplyDefaultPackHandler {
  constructor(
    private readonly proposals: ISetupProposalRepository,
    private readonly packs: IDefaultPackSource,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly viewer: DraftViewer,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<PackAppliedView, DomainError>> {
    const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, stored.value, this.clock.now());
    if (!access.ok) return access;
    if (stored.value.createdById !== ctx.tenant.userId) return { ok: false, error: DomainError.forbidden("Only the person who started this setup can change it") };
    if (stored.value.status !== "READY") return { ok: false, error: DomainError.validation("Wait until the documents have been read, then apply the starting answers.") };
    const draft = draftOf(stored.value);
    const pack = resolvePack(await this.packs.list(ctx.tenant.tenantId), draft.extras.start.sector);
    if (!pack) return { ok: false, error: DomainError.validation("There are no starting answers for this sector yet.") };
    const applied = applyPack(draft, pack);
    // Two writes, in this order: the proposal (suggested risks), then the decisions. `update` never writes the decisions, so a running
    // extraction cannot undo them. If the second write is lost, applying again finishes the job: a pack only fills what is empty.
    const saved = await this.proposals.update({ ...stored.value, proposal: applied.draft.proposal }, stored.value.updatedAt);
    if (!saved.ok) return saved;
    if (!saved.value) return { ok: false, error: new DomainError("CONFLICT", "Something changed while the starting answers were being applied. Try again.") };
    const between = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!between.ok) return between;
    if (!between.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const extrasSaved = await this.proposals.updateExtras(id, ctx.tenant.tenantId, applied.draft.extras, between.value.updatedAt);
    if (!extrasSaved.ok) return extrasSaved;
    if (!extrasSaved.value) return { ok: false, error: new DomainError("CONFLICT", "Something changed while the starting answers were being applied. Try again.") };
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "setup.pack.applied",
      entityType: "project_setup_proposal", entityId: id, newValue: JSON.stringify({ pack: pack.id, filled: applied.filled.length }),
    });
    const fresh = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!fresh.ok) return fresh;
    if (!fresh.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const view = await this.viewer.describe(fresh.value);
    return view.ok ? { ok: true, value: { view: view.value, packLabel: pack.label, filled: applied.filled } } : view;
  }
}
