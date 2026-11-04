import type { DomainError, Result, SourceBlock, TenantId } from "@donordesk/domain";
import { SETUP_AREA_APPLY_ORDER, SETUP_AREAS, checkProposal, extractionLayers, groundAreaPatch, applyKindOverrides, describeSources, joinBlocks, linkProposal, offerPlaceCountries, offerPlanDates, offerProjectCurrency, proposeCodes, redactForLlm, type SetupAreaKey } from "@donordesk/domain";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ISourceDocumentReader, ISetupAreaExtractor, ISetupProposalRepository, ISetupRunRepository, SetupUsage, StoredSetupProposal } from "../../ports/project-setup.js";
import { SETUP_PII_KEEP } from "./proposal-state.js";
import { runPool } from "./run-pool.js";

const addUsage = (a: SetupUsage, b: SetupUsage | undefined): SetupUsage =>
  b ? { calls: a.calls + b.calls, inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens } : a;

export interface ExtractionRunInput {
  tenantId: TenantId;
  proposalId: string;
  userId: string;
}

/**
 * Reads the stored document and runs the registered extractors in dependency order (Phase 36). The orchestrator knows no
 * area internals: it sequences whatever extractors are registered, grounds every proposed item against the redacted
 * document text, drops and counts the ungrounded, and stores what survives. One failed area leaves the others intact and
 * is re-runnable; the audit carries counts, never text.
 */
export class SetupExtractionOrchestrator {
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
    /** How many areas are read at the same time (the AI service paces itself; this keeps one document from taking every slot). */
    private readonly concurrency = 3,
  ) {}

  async run(input: ExtractionRunInput): Promise<Result<void, DomainError>> {
    const stored = await this.proposals.findById(input.proposalId, input.tenantId);
    if (!stored.ok) return stored;
    // Gone, discarded, or already finished (a rerun or a second schedule): nothing to do.
    if (!stored.value || stored.value.status !== "EXTRACTING") return { ok: true, value: undefined };
    const proposal = stored.value;
    const openRun = await this.openExtractRun(input.tenantId, input.proposalId);

    const blocks = await this.reader.read({ tenantId: proposal.tenantId, storageKey: proposal.sourceStorageKey, fileName: proposal.sourceName });
    if (!blocks.ok || blocks.value.length === 0) {
      const reason = blocks.ok ? "No readable text was found in this document." : blocks.error.message;
      await this.finishFailed(proposal, openRun, reason);
      return { ok: true, value: undefined };
    }
    // The model and the grounding check read the same redacted text, so a figure the model quotes is compared with
    // exactly what it was shown.
    // Each block is redacted before any extractor sees it, and the grounding text is joined from those same blocks.
    const redacted = applyKindOverrides(blocks.value, proposal.proposal.sources).map((b) => ({ ...b, text: redactForLlm(b.text, undefined, SETUP_PII_KEEP) }));
    const sourceText = joinBlocks(redacted);

    const byArea = new Map(this.extractors.map((e) => [e.area, e]));
    const ordered = SETUP_AREA_APPLY_ORDER.filter((area) => byArea.has(area));
    // Everything the areas share lives here; only `serial` touches it after an area has been read.
    const state = {
      data: { ...proposal.proposal },
      checked: 0, dropped: 0, okAreas: 0, failedAreas: 0,
      model: undefined as string | undefined, promptVersion: undefined as string | undefined,
      usage: { calls: 0, inputTokens: 0, outputTokens: 0 }, aiLimited: false,
    };
    // Areas finish in any order, but each one's merge and save happens alone, so none overwrites another's result.
    let chain: Promise<unknown> = Promise.resolve();
    const serial = <T>(work: () => Promise<T>): Promise<T> => {
      const next = chain.then(work, work);
      chain = next.catch(() => undefined);
      return next;
    };

    const readArea = async (area: SetupAreaKey): Promise<void> => {
      const extractor = byArea.get(area)!;
      // After the AI service has refused with a rate limit, only areas this document can answer without it still run.
      if (state.aiLimited && !extractor.canReadWithoutModel?.(redacted)) return;
      const runId = this.ids.generate();
      await this.runs.start({ id: runId, tenantId: input.tenantId, proposalId: input.proposalId, kind: "EXTRACT", area, status: "RUNNING", detail: {}, startedAt: this.clock.now() });
      // Everything an area depends on was read in an earlier layer, so its results are already in `state.data`.
      const prior: Record<string, unknown> = {};
      for (const dependency of SETUP_AREAS[area].dependsOn) {
        for (const field of SETUP_AREAS[dependency].fields) prior[field] = state.data[field as keyof typeof state.data];
      }
      const extracted = await extractor.extract({
        tenantId: input.tenantId, proposalId: input.proposalId, area,
        blocks: redacted, sourceText, prior,
        maxTokens: this.maxTokens, timeoutMs: this.timeoutMs,
      });
      const used = extracted.ok ? extracted.value.usage : undefined;
      const usageDetail: Record<string, number> = used ? { calls: used.calls, inputTokens: used.inputTokens, outputTokens: used.outputTokens } : {};
      if (!extracted.ok) {
        await serial(async () => { state.failedAreas += 1; });
        await this.runs.fail(runId, input.tenantId, { reason: extracted.error.message }, this.clock.now());
        // The AI service is limiting this organisation: asking again for every other area would only make it worse.
        if (extracted.error.code === "RATE_LIMITED") state.aiLimited = true;
        return;
      }
      const grounded = groundAreaPatch(area, extracted.value.fields, sourceText);
      if ("error" in grounded) {
        await serial(async () => { state.failedAreas += 1; state.usage = addUsage(state.usage, used); });
        await this.runs.fail(runId, input.tenantId, { reason: grounded.error, ...usageDetail }, this.clock.now());
        return;
      }
      await serial(async () => {
        state.data = { ...state.data, ...grounded.fields } as typeof state.data;
        state.checked += grounded.checked;
        state.dropped += grounded.dropped;
        state.okAreas += 1;
        state.usage = addUsage(state.usage, used);
        state.model = state.model ?? extracted.value.model;
        state.promptVersion = state.promptVersion ?? extracted.value.promptVersion;
        await this.runs.finish(runId, input.tenantId, {
          checked: grounded.checked, dropped: grounded.dropped, ...usageDetail,
          ...(grounded.leftOut.length > 0 ? { leftOut: JSON.stringify(grounded.leftOut) } : {}),
          ...(extracted.value.partlyRead ? { partlyRead: true } : {}),
        }, this.clock.now());
        // Saved after every area, so a later failure keeps what earlier areas read and the screen can poll real progress.
        await this.proposals.update({
          ...proposal, proposal: state.data,
          ...(state.model ? { model: state.model } : {}), ...(state.promptVersion ? { promptVersion: state.promptVersion } : {}),
        });
      });
    };

    for (const layer of extractionLayers(ordered)) await runPool(layer, this.concurrency, readArea);
    const { checked, dropped, okAreas, failedAreas, model, promptVersion, usage } = state;
    // Every area is read: items the documents did not tie to a result are placed by their wording where one result clearly fits.
    const data = { ...offerProjectCurrency(offerPlaceCountries(offerPlanDates(linkProposal(proposeCodes(state.data, "LIVE"))))), sources: describeSources(redacted, proposal.proposal.sources, this.feedsByDocument(redacted)) };

    const problems = checkProposal(data);
    const status = okAreas > 0 ? "READY" : "FAILED";
    const saved = await this.proposals.update({ ...proposal, status, proposal: data, problems, ...(model ? { model } : {}), ...(promptVersion ? { promptVersion } : {}) });
    if (!saved.ok) return saved;
    if (openRun) {
      await this.runs.finish(openRun.id, input.tenantId, { areas: okAreas, failed: failedAreas, checked, dropped, calls: usage.calls, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }, this.clock.now());
    }
    await this.audit.record({
      tenantId: input.tenantId, actorId: input.userId, eventType: status === "READY" ? "setup.extraction.finished" : "setup.extraction.failed",
      entityType: "project_setup_proposal", entityId: input.proposalId,
      newValue: JSON.stringify({ areas: okAreas, failed: failedAreas, checked, dropped, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }),
    });
    return { ok: true, value: undefined };
  }

  private async openExtractRun(tenantId: TenantId, proposalId: string) {
    const all = await this.runs.listByProposal(proposalId, tenantId);
    if (!all.ok) return undefined;
    return all.value.find((r) => r.kind === "EXTRACT" && r.area === undefined && r.status === "RUNNING");
  }

  private async finishFailed(proposal: StoredSetupProposal, openRun: { id: string } | undefined, reason: string): Promise<void> {
    if (openRun) await this.runs.fail(openRun.id, proposal.tenantId, { reason }, this.clock.now());
    await this.proposals.update({ ...proposal, status: "FAILED", problems: checkProposal(proposal.proposal) });
    await this.audit.record({
      tenantId: proposal.tenantId, actorId: proposal.createdById, eventType: "setup.extraction.failed",
      entityType: "project_setup_proposal", entityId: proposal.id,
      newValue: JSON.stringify({ reason }),
    });
  }

  /** For each file, the parts whose extractors take it (by its kind or its headings). */
  private feedsByDocument(blocks: ReadonlyArray<SourceBlock>): Map<string, SetupAreaKey[]> {
    const out = new Map<string, SetupAreaKey[]>();
    for (const e of this.extractors) {
      const documents = new Set(blocks.filter((b) => e.feeds?.(b)).map((b) => b.documentId));
      for (const id of documents) out.set(id, [...(out.get(id) ?? []), e.area]);
    }
    return out;
  }
}
