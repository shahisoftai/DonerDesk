import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { DomainError, type Result } from "@donordesk/domain";
import type { EmbeddingMatch, IEmbeddingStore } from "../llm/embedding.js";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

/**
 * Persists chunk embeddings in PostgreSQL via the pgvector extension and runs
 * cosine nearest-neighbor search over the HNSW index. All access is tenant-
 * scoped. The `embedding` vector column is managed with raw SQL (Prisma models
 * it as `Unsupported("vector(1536)")`), so reads and writes never go through
 * the generated client.
 */
export class PrismaEmbeddingStore implements IEmbeddingStore {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(input: {
    tenantId: string;
    chunkId: string;
    evidenceId: string;
    vector: number[];
    modelId: string;
    provider: string;
    dimensions: number;
  }): Promise<Result<void, DomainError>> {
    const id = randomUUID();
    const vectorLiteral = `[${input.vector.join(",")}]`;
    try {
      await this.prisma.$transaction([
        this.prisma.$executeRaw`
          DELETE FROM "EvidenceEmbedding"
          WHERE "chunkId" = ${input.chunkId} AND "modelId" = ${input.modelId}`,
        this.prisma.$executeRaw`
          INSERT INTO "EvidenceEmbedding" ("id","chunkId","tenantId","modelId","provider","dimensions","embedding","createdAt")
          VALUES (${id}, ${input.chunkId}, ${input.tenantId}, ${input.modelId}, ${input.provider}, ${input.dimensions}, ${vectorLiteral}::vector, now())`,
      ]);
      return ok(undefined);
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(`EmbeddingStore.upsert failed: ${error instanceof Error ? error.message : String(error)}`),
      };
    }
  }

  async nearestNeighbors(input: {
    tenantId: string;
    vector: number[];
    limit: number;
    evidenceIds?: string[];
  }): Promise<Result<EmbeddingMatch[], DomainError>> {
    const queryLiteral = `[${input.vector.join(",")}]`;
    try {
      const rows = await this.prisma.$queryRaw<Array<{ chunkId: string; evidenceId: string; score: number }>>`
        SELECT e."chunkId" AS "chunkId", c."evidenceId" AS "evidenceId",
               1 - (e.embedding <=> ${queryLiteral}::vector) AS score
        FROM "EvidenceEmbedding" e
        JOIN "EvidenceChunk" c ON c."id" = e."chunkId"
        WHERE e."tenantId" = ${input.tenantId}
          AND e.embedding IS NOT NULL
          AND (${input.evidenceIds?.length ? true : false} = false OR c."evidenceId" = ANY(${input.evidenceIds}::text[]))
        ORDER BY e.embedding <=> ${queryLiteral}::vector
        LIMIT ${input.limit}
      `;
      return ok(
        rows.map((r) => ({
          chunkId: r.chunkId,
          evidenceId: r.evidenceId,
          score: Number(r.score),
        })),
      );
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(`EmbeddingStore.nearestNeighbors failed: ${error instanceof Error ? error.message : String(error)}`),
      };
    }
  }

  async countMissing(tenantId: string): Promise<Result<number, DomainError>> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "EvidenceChunk" c
        WHERE c."tenantId" = ${tenantId}
          AND NOT EXISTS (
            SELECT 1 FROM "EvidenceEmbedding" e WHERE e."chunkId" = c."id" AND e.embedding IS NOT NULL
          )
      `;
      return ok(Number(rows[0]?.count ?? 0));
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(`EmbeddingStore.countMissing failed: ${error instanceof Error ? error.message : String(error)}`),
      };
    }
  }
}
