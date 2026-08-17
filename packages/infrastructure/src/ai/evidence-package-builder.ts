import { createHash } from "node:crypto";
import { DomainError, type Result, type TenantId } from "@donordesk/domain";
import type { EvidencePackage, IEvidencePackageBuilder } from "@donordesk/application";
import type { IEvidenceRepository } from "@donordesk/application";
import { EvidenceChunker } from "./chunker.js";

const CHUNKER_VERSION = "evidence-chunker-v1";

/**
 * Builds generation-ready evidence packages. The source text consumed at
 * generation time (AI summary when available, otherwise title) is chunked and
 * hashed so the exact bytes are snapshotted; later evidence edits cannot
 * silently alter an approved report.
 */
export class EvidencePackageBuilder implements IEvidencePackageBuilder {
  private readonly chunker: EvidenceChunker;

  constructor(private readonly evidence: IEvidenceRepository, chunker?: EvidenceChunker) {
    this.chunker = chunker ?? new EvidenceChunker();
  }

  async build(input: { tenantId: TenantId; evidenceIds: string[] }): Promise<Result<EvidencePackage[], DomainError>> {
    const out: EvidencePackage[] = [];
    for (const id of input.evidenceIds) {
      const r = await this.evidence.findById(id, input.tenantId);
      if (!r.ok) return r;
      if (!r.value) continue;
      const e = r.value;
      const sourceText = e.aiSummary || e.title || "";

      const hash = createHash("sha256")
        .update(JSON.stringify({
          id: e.id,
          fileName: e.fileName,
          title: e.title,
          fileUrl: e.fileUrl,
          text: sourceText,
          updatedAt: e.updatedAt.toISOString(),
        }))
        .digest("hex");

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
