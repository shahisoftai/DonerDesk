import { createHash } from "node:crypto";
import { DomainError, redactForLlm, resolvePiiPolicy, type PiiPolicy, type Result, type TenantId } from "@donordesk/domain";
import type { EvidencePackage, IEvidencePackageBuilder } from "@donordesk/application";
import type { IEvidenceRepository } from "@donordesk/application";
import { EvidenceChunker } from "./chunker.js";

const CHUNKER_VERSION = "evidence-chunker-v1";

/**
 * Builds generation-ready evidence packages. The source text consumed at
 * generation time (raw extracted document text when available, otherwise AI
 * summary, otherwise title) is chunked and hashed so the exact bytes are
 * snapshotted; later evidence edits cannot silently alter an approved report.
 *
 * The text is redacted for the model (LLM_PII_POLICY, default "redact"): the
 * stored document is untouched, but what leaves for a third-party provider is
 * not. This is the one place evidence text becomes model input, and both the
 * writer and the claim verifier read these same packages, so a redacted
 * quotation still verifies against the chunk it came from.
 */
export class EvidencePackageBuilder implements IEvidencePackageBuilder {
  private readonly chunker: EvidenceChunker;
  private readonly piiPolicy: PiiPolicy;

  constructor(private readonly evidence: IEvidenceRepository, chunker?: EvidenceChunker, piiPolicy?: PiiPolicy) {
    this.chunker = chunker ?? new EvidenceChunker();
    this.piiPolicy = piiPolicy ?? resolvePiiPolicy(process.env.LLM_PII_POLICY);
  }

  async build(input: { tenantId: TenantId; evidenceIds: string[] }): Promise<Result<EvidencePackage[], DomainError>> {
    const out: EvidencePackage[] = [];
    for (const id of input.evidenceIds) {
      const r = await this.evidence.findById(id, input.tenantId);
      if (!r.ok) return r;
      if (!r.value) continue;
      const e = r.value;
      const storedText = e.extractedText || e.aiSummary || e.title || "";
      // The hash is over the stored text, so tampering with the document is
      // still detected; the model sees the redacted text.
      const hash = createHash("sha256")
        .update(JSON.stringify({
          id: e.id,
          fileName: e.fileName,
          title: e.title,
          fileUrl: e.fileUrl,
          text: storedText,
          updatedAt: e.updatedAt.toISOString(),
        }))
        .digest("hex");

      let sourceText: string;
      try {
        sourceText = redactForLlm(storedText, this.piiPolicy);
      } catch (error) {
        // The "reject" policy refuses to send PII: the package is not built,
        // so the section falls back to the deterministic draft.
        return { ok: false, error: DomainError.forbidden((error as Error).message) };
      }
      const chunkResult = this.chunker.chunk(sourceText);
      out.push({
        evidenceId: e.id,
        title: e.title,
        fileName: e.fileName,
        evidenceType: e.evidenceType,
        verificationStatus: e.verificationStatus,
        confidentialityLevel: e.confidentialityLevel,
        extractedText: sourceText,
        chunks: chunkResult.chunks.map((c) => ({
          chunkId: `${e.id}:${c.chunkIndex}`,
          text: c.text,
          tokenCount: c.tokenCount,
          chunkIndex: c.chunkIndex,
        })),
        evidenceHash: hash,
        evidenceUpdatedAt: e.updatedAt,
        chunkerVersion: CHUNKER_VERSION,
      });
    }
    return { ok: true, value: out };
  }
}
