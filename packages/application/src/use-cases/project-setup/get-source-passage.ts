import { DomainError, applyKindOverrides, redactForLlm, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { ISetupProposalRepository, ISourceDocumentReader } from "../../ports/project-setup.js";
import { SETUP_PII_KEEP, assertProposalAccess } from "./proposal-state.js";

export interface SourcePassage {
  documentName: string;
  sheet: string | null;
  /** The block the quote is in, and the one before it for context, as the model saw them (personal details removed). */
  text: string;
  before: string | null;
}

/**
 * "Show in the document" (Phase 37.6): the passage a proposed item was read from, so a person can see the quote in its place.
 * The documents are read again from the organisation's Drive (nothing is kept on the server) and the same redaction is
 * applied as for the model, so the person sees exactly what was read.
 */
export class GetSetupSourcePassageHandler {
  constructor(private readonly proposals: ISetupProposalRepository, private readonly reader: ISourceDocumentReader, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, id: string, documentId: string, block: number): Promise<Result<SourcePassage, DomainError>> {
    const stored = await this.proposals.findById(id, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    if (!stored.value) return { ok: false, error: DomainError.notFound("Setup proposal", id) };
    const access = assertProposalAccess(ctx, stored.value, this.clock.now());
    if (!access.ok) return access;
    if (stored.value.createdById !== ctx.tenant.userId) return { ok: false, error: DomainError.forbidden("Only the person who started this proposal can review it") };
    const read = await this.reader.read({ tenantId: stored.value.tenantId, storageKey: stored.value.sourceStorageKey, fileName: stored.value.sourceName });
    if (!read.ok) return read;
    const blocks = applyKindOverrides(read.value, stored.value.proposal.sources);
    const at = blocks.findIndex((b) => b.documentId === documentId && b.index === block);
    if (at < 0) return { ok: false, error: DomainError.notFound("Passage", `${documentId}:${block}`) };
    const found = blocks[at]!;
    const previous = at > 0 && blocks[at - 1]!.documentId === documentId ? blocks[at - 1]! : null;
    return {
      ok: true,
      value: {
        documentName: found.documentName ?? stored.value.sourceName,
        sheet: found.sheet ?? null,
        text: redactForLlm(found.text, undefined, SETUP_PII_KEEP),
        before: previous ? redactForLlm(previous.text, undefined, SETUP_PII_KEEP) : null,
      },
    };
  }
}
