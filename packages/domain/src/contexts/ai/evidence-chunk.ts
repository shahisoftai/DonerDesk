import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export interface EvidenceChunkProps {
  evidenceId: string;
  tenantId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
}

export class EvidenceChunk extends Entity<string> {
  private constructor(
    id: string,
    private props: EvidenceChunkProps,
    createdAt: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    props: EvidenceChunkProps;
  }): EvidenceChunk {
    if (!input.props.evidenceId) throw DomainError.validation("Evidence ID required");
    if (!input.props.tenantId) throw DomainError.validation("Tenant ID required");
    if (input.props.chunkIndex < 0) throw DomainError.validation("Chunk index must be non-negative");
    if (!input.props.text) throw DomainError.validation("Chunk text required");
    return new EvidenceChunk(input.id, input.props, new Date());
  }

  static rehydrate(input: {
    id: string;
    props: EvidenceChunkProps;
    createdAt: Date;
  }): EvidenceChunk {
    return new EvidenceChunk(input.id, input.props, input.createdAt);
  }

  get evidenceId(): string { return this.props.evidenceId; }
  get tenantId(): string { return this.props.tenantId; }
  get chunkIndex(): number { return this.props.chunkIndex; }
  get text(): string { return this.props.text; }
  get tokenCount(): number { return this.props.tokenCount; }
}

export interface EvidenceEmbeddingProps {
  chunkId: string;
  tenantId: string;
  modelId: string;
  provider: string;
  vector: number[];
  dimensions: number;
}

export class EvidenceEmbedding extends Entity<string> {
  private constructor(
    id: string,
    private props: EvidenceEmbeddingProps,
    createdAt: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    props: EvidenceEmbeddingProps;
  }): EvidenceEmbedding {
    if (!input.props.chunkId) throw DomainError.validation("Chunk ID required");
    if (!input.props.tenantId) throw DomainError.validation("Tenant ID required");
    if (!input.props.modelId) throw DomainError.validation("Model ID required");
    if (!input.props.vector.length) throw DomainError.validation("Vector required");
    if (input.props.dimensions <= 0) throw DomainError.validation("Dimensions must be positive");
    if (input.props.vector.length !== input.props.dimensions) throw DomainError.validation("Vector length must match dimensions");
    if (input.props.vector.some((value) => !Number.isFinite(value))) throw DomainError.validation("Vector values must be finite");
    return new EvidenceEmbedding(input.id, input.props, new Date());
  }

  static rehydrate(input: {
    id: string;
    props: EvidenceEmbeddingProps;
    createdAt: Date;
  }): EvidenceEmbedding {
    const embedding = EvidenceEmbedding.create({ id: input.id, props: input.props });
    return new EvidenceEmbedding(embedding.id, input.props, input.createdAt);
  }

  get chunkId(): string { return this.props.chunkId; }
  get tenantId(): string { return this.props.tenantId; }
  get modelId(): string { return this.props.modelId; }
  get provider(): string { return this.props.provider; }
  get vector(): number[] { return [...this.props.vector]; }
  get dimensions(): number { return this.props.dimensions; }

  cosineSimilarity(other: EvidenceEmbedding): number {
    if (this.props.tenantId !== other.props.tenantId) {
      throw DomainError.forbidden("Cannot compare embeddings across tenants");
    }
    if (this.props.dimensions !== other.props.dimensions) {
      throw DomainError.validation("Cannot compare embeddings of different dimensions");
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < this.props.vector.length; i++) {
      dotProduct += this.props.vector[i]! * other.props.vector[i]!;
      normA += this.props.vector[i]! * this.props.vector[i]!;
      normB += other.props.vector[i]! * other.props.vector[i]!;
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) throw DomainError.validation("Cannot compare zero-magnitude embeddings");
    return dotProduct / denominator;
  }
}
