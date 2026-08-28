import type { DomainError, Result } from "@donordesk/domain";

/**
 * A dense embedding vector produced for a text chunk.
 */
export interface EmbeddingVector {
  values: number[];
  dimensions: number;
}

/**
 * Nearest-neighbor hit returned by the embedding store.
 */
export interface EmbeddingMatch {
  chunkId: string;
  evidenceId: string;
  /** Cosine similarity in [0, 1]; higher is more similar. */
  score: number;
}

/**
 * Generates embedding vectors for text. Implementations wrap a concrete
 * embedding model (hosted provider or local Ollama). This is a narrow port so
 * the embedding model is swappable without touching retrieval logic.
 */
export interface IEmbeddingGenerator {
  /** Stable identifier of the embedding model (used for provenance). */
  readonly modelId: string;
  /** Provider name used for provenance (e.g. "ollama", "openai"). */
  readonly provider: string;
  /** Fixed vector dimensions produced by this model. */
  readonly dimensions: number;
  embed(text: string): Promise<Result<EmbeddingVector, DomainError>>;
}

/**
 * Persists and queries chunk embeddings via pgvector. This is an
 * infrastructure-level port: retrieval lives in infrastructure, so this need
 * not surface in the application layer.
 */
export interface IEmbeddingStore {
  /** Insert or refresh the embedding for a single evidence chunk. */
  upsert(input: {
    tenantId: string;
    chunkId: string;
    evidenceId: string;
    vector: number[];
    modelId: string;
    provider: string;
    dimensions: number;
  }): Promise<Result<void, DomainError>>;

  /** Cosine nearest-neighbor search, tenant-scoped, optionally chunk-scoped. */
  nearestNeighbors(input: {
    tenantId: string;
    vector: number[];
    limit: number;
    /** Restrict search to a set of evidence IDs already in the current report. */
    evidenceIds?: string[];
  }): Promise<Result<EmbeddingMatch[], DomainError>>;

  /** Number of chunks for the tenant with no embedding yet (for backfill). */
  countMissing(tenantId: string): Promise<Result<number, DomainError>>;
}
