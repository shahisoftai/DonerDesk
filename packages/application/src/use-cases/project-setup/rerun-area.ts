import type { Result, SetupAreaKey } from "@donordesk/domain";
import { DomainError, SETUP_AREAS, checkProposal, groundAreaPatch, joinBlocks, redactForLlm } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ISourceDocumentReader, ISetupAreaExtractor, ISetupProposalRepository, ISetupRunRepository } from "../../ports/project-setup.js";
import { assertProposalAccess } from "./proposal-state.js";

/**
 * Re-extracts one area, keeping every edit in the other areas (Phase 36). The area's own decisions are replaced by the new
 * reading; the screen warns about that before running it. Same caps and grounding as the first read.
 */
export class RerunSetupAreaHandler {
  constructor(
    private readonly proposals: ISetupProposalRepository,
    private readonly runs: ISetupRunRepository,
    private readonly reader: ISourceDocumentReader,
    private readonly extractors: ReadonlyArray<ISetupAreaExtractor>,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly ids: IIdGenerator,
    private readonly maxTokens = 8192,
    private readonly timeoutMs = 120_000,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string, area: SetupAreaKey): Promise<Result<{ checked: number; dropped: number }, DomainError>> {
    const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, stored.value, this.clock.now());
    if (!access.ok) return access;
    if (stored.value.createdById !== ctx.tenant.userId) {
      return { ok: false, error: DomainError.forbidden("Only the person who started this proposal can re-run an area") };
    }
    if (stored.value.status === "EXTRACTING") {
      return { ok: false, error: DomainError.validation("The document is still being read. Try again in a moment.") };
    }
    if (stored.value.status !== "READY") {
      return { ok: false, error: DomainError.validation("Only a proposal that is ready for review can be re-read.") };
    }
    const extractor = this.extractors.find((e) => e.area === area);
    if (!extractor) {
      return { ok: false, error: DomainError.validation("This area cannot be read again just now.") };
    }
    const proposal = stored.value;
    const blocks = await this.reader.read({ tenantId: proposal.tenantId, storageKey: proposal.sourceStorageKey, fileName: proposal.sourceName });
    if (!blocks.ok) return blocks;
    // Each block is redacted before any extractor sees it, and the grounding text is joined from those same blocks.
    const redacted = blocks.value.map((b) => ({ ...b, text: redactForLlm(b.text) }));
    const sourceText = joinBlocks(redacted);
    const runId = this.ids.generate();
    const runStarted = await this.runs.start({ id: runId, tenantId: ctx.tenant.tenantId, proposalId: id, kind: "EXTRACT", area, status: "RUNNING", detail: {}, startedAt: this.clock.now() });
    if (!runStarted.ok) return runStarted;
    const prior: Record<string, unknown> = {};
    for (const dependency of SETUP_AREAS[area].dependsOn) {
      for (const field of SETUP_AREAS[dependency].fields) prior[field] = proposal.proposal[field as keyof typeof proposal.proposal];
    }
    const extracted = await extractor.extract({
      tenantId: ctx.tenant.tenantId, proposalId: id, area,
      blocks: redacted, sourceText, prior,
      maxTokens: this.maxTokens, timeoutMs: this.timeoutMs,
    });
    if (!extracted.ok) {
      await this.runs.fail(runId, ctx.tenant.tenantId, { reason: extracted.error.message }, this.clock.now());
      await this.audit.record({
        tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "setup.extraction.failed",
        entityType: "project_setup_proposal", entityId: id, newValue: JSON.stringify({ area, reason: extracted.error.message }),
      });
      return { ok: false, error: extracted.error };
    }
    const grounded = groundAreaPatch(area, extracted.value.fields, sourceText);
    if ("error" in grounded) {
      await this.runs.fail(runId, ctx.tenant.tenantId, { reason: grounded.error }, this.clock.now());
      return { ok: false, error: DomainError.validation(grounded.error) };
    }
    // Replaces this area's fields; the other areas keep whatever the person accepted and edited.
    const nextProposal = { ...proposal.proposal, ...grounded.fields } as typeof proposal.proposal;
    const saved = await this.proposals.update({
      ...proposal,
      proposal: nextProposal,
      problems: checkProposal(nextProposal),
      model: extracted.value.model ?? proposal.model,
      promptVersion: extracted.value.promptVersion ?? proposal.promptVersion,
    });
    if (!saved.ok) return saved;
    const used = extracted.value.usage;
    await this.runs.finish(runId, ctx.tenant.tenantId, { checked: grounded.checked, dropped: grounded.dropped, ...(used ? { calls: used.calls, inputTokens: used.inputTokens, outputTokens: used.outputTokens } : {}) }, this.clock.now());
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "setup.extraction.finished",
      entityType: "project_setup_proposal", entityId: id,
      newValue: JSON.stringify({ area, checked: grounded.checked, dropped: grounded.dropped }),
    });
    return { ok: true, value: { checked: grounded.checked, dropped: grounded.dropped } };
  }
}
