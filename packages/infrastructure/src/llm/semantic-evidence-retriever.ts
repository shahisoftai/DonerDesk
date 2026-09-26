import { DomainError, scoreSimilarity, type Result } from "@donordesk/domain";
import type { IEvidenceRetriever, EvidencePackage, RetrievedEvidence, RetrievalRequest } from "@donordesk/application";
import type { IEmbeddingGenerator, IEmbeddingStore } from "./embedding.js";

/**
 * Lexical fallback scoring used when semantic retrieval is unavailable (no
 * embedding model, extension not installed, or embeddings not yet backfilled
 * — the normal state in production today, see donor-report quality audit
 * 2026-09-17). Uses the shared stemmed/weighted scorer (`scoreSimilarity`) so
 * ranking is meaningfully better than raw token overlap even while semantic
 * retrieval is unavailable — this is the path evidence retrieval actually
 * runs through for every tenant today.
 */
function lexicalRetrieve(packages: EvidencePackage[], input: RetrievalRequest, maxTokens: number): RetrievedEvidence[] {
  const query = [input.sectionTitle, ...input.entities, ...input.dates, ...input.indicatorCodes].filter(Boolean).join(" ");
  const scored: RetrievedEvidence[] = [];
  for (const pkg of packages) {
    if (input.evidenceType && pkg.evidenceType !== input.evidenceType) continue;
    if (input.verificationStatus && pkg.verificationStatus !== input.verificationStatus) continue;
    for (const chunk of pkg.chunks) {
      const score = query.trim().length === 0 ? 0 : scoreSimilarity(query, chunk.text);
      if (score === 0) continue;
      scored.push({ evidenceId: pkg.evidenceId, chunkId: chunk.chunkId, chunkText: chunk.text, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return budget(scored, maxTokens);
}

function budget(items: RetrievedEvidence[], maxTokens: number): RetrievedEvidence[] {
  let budget = maxTokens;
  const result: RetrievedEvidence[] = [];
  for (const item of items) {
    const tokenCount = item.chunkText.split(/\s+/).length;
    if (budget - tokenCount < 0) continue;
    budget -= tokenCount;
    result.push(item);
  }
  return result;
}

/**
 * Semantic evidence retrieval over pgvector. Embeds the retrieval request and
 * returns the most similar chunks from the provided (already tenant-scoped)
 * evidence packages. Falls back to lexical ranking when semantic retrieval is
 * not yet available, so it is always substitutable behind IEvidenceRetriever.
 */
export class SemanticEvidenceRetriever implements IEvidenceRetriever {
  constructor(
    private readonly packages: EvidencePackage[],
    private readonly generator: IEmbeddingGenerator,
    private readonly store: IEmbeddingStore,
  ) {}

  async retrieve(input: RetrievalRequest): Promise<Result<RetrievedEvidence[], DomainError>> {
    const maxTokens = input.maxTokens ?? 4000;
    const query = [input.sectionTitle, ...input.entities, ...input.dates, ...input.indicatorCodes]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!query || !input.tenantId) {
      return { ok: true, value: lexicalRetrieve(this.packages, input, maxTokens) };
    }

    const embedded = await this.generator.embed(query);
    if (!embedded.ok) {
      return { ok: true, value: lexicalRetrieve(this.packages, input, maxTokens) };
    }

    const matches = await this.store.nearestNeighbors({
      tenantId: input.tenantId,
      vector: embedded.value.values,
      limit: 60,
      evidenceIds: this.packages.map((p) => p.evidenceId),
    });
    if (!matches.ok || matches.value.length === 0) {
      return { ok: true, value: lexicalRetrieve(this.packages, input, maxTokens) };
    }

    // Map chunk IDs back to the in-memory packages to obtain provenance-safe text.
    const chunkById = new Map<string, { evidenceId: string; text: string }>();
    for (const pkg of this.packages) {
      if (input.evidenceType && pkg.evidenceType !== input.evidenceType) continue;
      if (input.verificationStatus && pkg.verificationStatus !== input.verificationStatus) continue;
      for (const chunk of pkg.chunks) {
        chunkById.set(chunk.chunkId, { evidenceId: pkg.evidenceId, text: chunk.text });
      }
    }

    const scored: RetrievedEvidence[] = [];
    for (const match of matches.value) {
      const entry = chunkById.get(match.chunkId);
      if (!entry) continue;
      scored.push({ evidenceId: entry.evidenceId, chunkId: match.chunkId, chunkText: entry.text, score: match.score });
    }
    scored.sort((a, b) => b.score - a.score);

    return { ok: true, value: budget(scored, maxTokens) };
  }
}
