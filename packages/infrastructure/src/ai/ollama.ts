export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

export interface OllamaCompletionRequest {
  model: string;
  prompt: string;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
    stop?: string[];
  };
  stream?: boolean;
}

export interface OllamaCompletionResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
}

export interface OllamaEmbeddingResponse {
  embedding: number[];
}

export interface OllamaModelsResponse {
  models: Array<{
    name: string;
    model: string;
    size: number;
    digest: string;
    modified_at: string;
  }>;
}

export class OllamaProvider {
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(config: OllamaConfig) {
    const url = new URL(config.baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Ollama base URL must use HTTP or HTTPS");
    if (!config.model.trim()) throw new Error("Ollama model is required");
    if (config.timeoutMs !== undefined && (!Number.isFinite(config.timeoutMs) || config.timeoutMs < 1)) throw new Error("Ollama timeout must be positive");
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.defaultModel = config.model;
    this.timeoutMs = config.timeoutMs ?? 60000;
  }

  async complete(prompt: string, model?: string, options?: OllamaCompletionRequest["options"]): Promise<{
    text: string;
    model: string;
    tokens: number;
    latencyMs: number;
  }> {
    const start = Date.now();
    const response = await this.request<OllamaCompletionResponse>("/api/generate", {
      model: model ?? this.defaultModel,
      prompt,
      options,
      stream: false,
    });
    const latencyMs = Date.now() - start;

    return {
      text: response.response,
      model: response.model,
      tokens: response.eval_count ?? 0,
      latencyMs,
    };
  }

  async embed(prompt: string, model?: string): Promise<{
    embedding: number[];
    latencyMs: number;
  }> {
    const start = Date.now();
    const response = await this.request<OllamaEmbeddingResponse>("/api/embeddings", {
      model: model ?? this.defaultModel,
      prompt,
    });
    const latencyMs = Date.now() - start;
    if (!Array.isArray(response.embedding) || response.embedding.length === 0 || response.embedding.some((value) => !Number.isFinite(value))) {
      throw new Error("Ollama returned an invalid embedding");
    }

    return {
      embedding: response.embedding,
      latencyMs,
    };
  }

  async listModels(): Promise<string[]> {
    const response = await this.requestGet<OllamaModelsResponse>("/api/tags");
    return response.models.map((m) => m.name);
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.requestGet<{ error?: string }>("/api/tags");
      return !response.error;
    } catch {
      return false;
    }
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
      }

      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestGet<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
      }

      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createOllamaProvider(config: OllamaConfig): OllamaProvider {
  return new OllamaProvider(config);
}
