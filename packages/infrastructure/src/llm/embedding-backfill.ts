import { PrismaClient } from "@prisma/client";
import type { IEmbeddingGenerator, IEmbeddingStore } from "./embedding.js";

/**
 * Backfills missing chunk embeddings. Idempotent: only chunks without an
 * embedding for the configured model are processed, and each upsert replaces
 * the previous embedding for that (chunk, model) pair.
 */
export class EmbeddingBackfillJob {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly generator: IEmbeddingGenerator,
    private readonly store: IEmbeddingStore,
    private readonly batchSize = 50,
  ) {}

  async run(): Promise<{ processed: number; failed: number; remaining: number }> {
    let processed = 0;
    let failed = 0;
    let cursor: string | null = null;
    const modelId = this.generator.modelId;

    // Iterate chunks that have no embedding for this model yet.
    for (;;) {
      const rows = await this.prisma.$queryRaw<Array<{ id: string; tenantId: string; evidenceId: string; text: string }>>`
        SELECT c."id", c."tenantId", c."evidenceId", c."text"
        FROM "EvidenceChunk" c
        WHERE ($1::text IS NULL OR c."id" > $1)
          AND NOT EXISTS (
            SELECT 1 FROM "EvidenceEmbedding" e
            WHERE e."chunkId" = c."id" AND e."modelId" = ${modelId} AND e.embedding IS NOT NULL
          )
        ORDER BY c."id"
        LIMIT ${this.batchSize}
      `;
      if (rows.length === 0) break;

      for (const row of rows) {
        const embedded = await this.generator.embed(row.text);
        if (!embedded.ok) {
          failed++;
          continue;
        }
        const saved = await this.store.upsert({
          tenantId: row.tenantId,
          chunkId: row.id,
          evidenceId: row.evidenceId,
          vector: embedded.value.values,
          modelId,
          provider: this.generator.provider,
          dimensions: embedded.value.dimensions,
        });
        if (saved.ok) processed++;
        else failed++;
      }

      cursor = rows[rows.length - 1]!.id;
    }

    const missing = await this.store.countMissing("");
    const remaining = missing.ok ? missing.value : 0;
    return { processed, failed, remaining };
  }
}
