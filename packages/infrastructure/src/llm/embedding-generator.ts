import { DomainError, type Result } from "@donordesk/domain";
import type { EmbeddingVector, IEmbeddingGenerator } from "./embedding.js";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

/**
 * OpenAI embeddings adapter. Uses the standard /v1/embeddings endpoint. The
 * default model is text-embedding-3-small (1536 dimensions).
 */
export class OpenAiEmbeddingGenerator implements IEmbeddingGenerator {
  readonly modelId: string;
  readonly provider = "openai";
  readonly dimensions: number;

  constructor(
    private readonly apiKey: string,
    model = "text-embedding-3-small",
    dimensions = 1536,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the OpenAI embedding generator");
    this.modelId = model;
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<Result<EmbeddingVector, DomainError>> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.modelId, input: text }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        return { ok: false, error: DomainError.invariant(`OpenAI embeddings API error: ${response.status}`) };
      }
      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
      };
      const embedding = data.data[0]?.embedding;
      if (!embedding || !Array.isArray(embedding) || embedding.length !== this.dimensions) {
        return { ok: false, error: DomainError.invariant("OpenAI embeddings response was malformed") };
      }
      return ok({ values: embedding, dimensions: this.dimensions });
    } catch (error) {
      return { ok: false, error: DomainError.invariant(`OpenAI embeddings failed: ${error instanceof Error ? error.message : String(error)}`) };
    }
  }
}

/**
 * Ollama embeddings adapter. Calls the local /api/embed endpoint so no data
 * leaves the host. nomic-embed-text (768d) is a solid general-purpose default.
 */
export class OllamaEmbeddingGenerator implements IEmbeddingGenerator {
  readonly modelId: string;
  readonly provider = "ollama";
  readonly dimensions: number;

  constructor(
    private readonly baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    model = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text",
    dimensions = Number(process.env.OLLAMA_EMBED_DIMENSIONS ?? 768),
  ) {
    this.modelId = model;
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<Result<EmbeddingVector, DomainError>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.modelId, input: text }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        return { ok: false, error: DomainError.invariant(`Ollama embeddings API error: ${response.status}`) };
      }
      const data = (await response.json()) as {
        embeddings?: Array<number[]>;
        error?: string;
      };
      if (data.error) {
        return { ok: false, error: DomainError.invariant(`Ollama embeddings error: ${data.error}`) };
      }
      const embedding = data.embeddings?.[0];
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        return { ok: false, error: DomainError.invariant("Ollama embeddings response was empty") };
      }
      return ok({ values: embedding, dimensions: embedding.length });
    } catch (error) {
      return { ok: false, error: DomainError.invariant(`Ollama embeddings failed: ${error instanceof Error ? error.message : String(error)}`) };
    }
  }
}

/**
 * Factory: build an embedding generator from config. Defaults to Ollama for a
 * zero-external-API, self-hosted baseline; OpenAI is selected when configured.
 */
export function createEmbeddingGenerator(config?: {
  provider?: "openai" | "ollama";
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): IEmbeddingGenerator {
  const provider = config?.provider ?? process.env.EMBEDDING_PROVIDER ?? "ollama";
  if (provider === "openai") {
    return new OpenAiEmbeddingGenerator(
      config?.apiKey ?? process.env.OPENAI_API_KEY ?? "",
      config?.model,
      undefined,
      config?.baseUrl,
    );
  }
  return new OllamaEmbeddingGenerator(config?.baseUrl, config?.model);
}
