import { DomainError } from "@donordesk/domain";
import type { IEvidenceRetriever, EvidencePackage, RetrievedEvidence, RetrievalRequest } from "@donordesk/application";
import type { Result } from "@donordesk/domain";

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean));
}

/**
 * Deterministic section-aware evidence retrieval (Phase 4). Ranks every chunk
 * across the provided evidence packages by lexical overlap with the request's
 * section title, entities, dates, and indicator codes, then applies optional
 * evidence-type, verification-status, and token-budget filters. A persisted
 * retrieval manifest can record the resulting chunk IDs for reproduction; this
 * strategy itself performs no LLM calls and returns only provenance-safe text.
 */
export class DeterministicEvidenceRetriever implements IEvidenceRetriever {
  constructor(private readonly packages: EvidencePackage[]) {}

  async retrieve(input: RetrievalRequest): Promise<Result<RetrievedEvidence[], DomainError>> {
    const queryTokens = new Set<string>();
    for (const text of [input.sectionTitle, ...input.entities, ...input.dates, ...input.indicatorCodes]) {
      for (const token of tokens(text)) queryTokens.add(token);
    }

    const scored: RetrievedEvidence[] = [];
    for (const pkg of this.packages) {
      if (input.evidenceType && pkg.evidenceType !== input.evidenceType) continue;
      if (input.verificationStatus && pkg.verificationStatus !== input.verificationStatus) continue;
      for (const chunk of pkg.chunks) {
        const chunkTokens = tokens(chunk.text);
        let overlap = 0;
        for (const token of queryTokens) if (chunkTokens.has(token)) overlap++;
        const score = queryTokens.size === 0 ? 0 : overlap / queryTokens.size;
        if (score === 0) continue;
        scored.push({ evidenceId: pkg.evidenceId, chunkId: chunk.chunkId, chunkText: chunk.text, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    let budget = input.maxTokens ?? 4000;
    const result: RetrievedEvidence[] = [];
    for (const item of scored) {
      const tokenCount = item.chunkText.split(/\s+/).length;
      if (budget - tokenCount < 0) continue;
      budget -= tokenCount;
      result.push(item);
    }

    return { ok: true, value: result };
  }
}
