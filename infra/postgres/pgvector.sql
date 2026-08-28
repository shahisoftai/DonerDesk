-- pgvector setup for semantic evidence retrieval.
-- Idempotent: safe to run repeatedly via db:migrate.
-- Requires the pgvector extension (v0.8.6). Dev image: pgvector/pgvector:pg16.

CREATE EXTENSION IF NOT EXISTS vector;

-- Real vector column alongside the legacy JSON text column.
ALTER TABLE "EvidenceEmbedding" ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Tenant-scoped HNSW cosine index. Build after embeddings are loaded for
-- performance. Iterative scans improve filtered recall under tenant RLS.
CREATE INDEX IF NOT EXISTS evidence_embedding_hnsw_idx
  ON "EvidenceEmbedding" USING hnsw (embedding vector_cosine_ops);
