import { DomainError, type Result } from "@donordesk/domain";
import type {
  AiReporterRewriteRequest,
  AiReporterRewriteResponse,
  AiReporterSectionRequest,
  AiReporterSectionResponse,
  IWorkerClient,
} from "./ai-reporter-worker.js";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

/**
 * HTTP transport for the AI Reporter worker. Points at the Python FastAPI
 * worker's /v1/ai-reporter endpoints. On any transport or non-2xx failure it
 * returns a DomainError so the caller can fall back to the deterministic stub
 * without crashing the generation loop.
 */
export class HttpWorkerClient implements IWorkerClient {
  constructor(
    private readonly baseUrl = process.env.AI_REPORTER_URL ?? "http://localhost:5000",
    private readonly timeoutMs = 180000,
    private readonly internalToken = process.env.INTERNAL_TOKEN ?? "",
  ) {}

  private async post<T>(path: string, body: unknown): Promise<Result<T, DomainError>> {
    let response: Response;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.internalToken) headers["X-Internal-Token"] = this.internalToken;
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(`AI Reporter request failed: ${error instanceof Error ? error.message : String(error)}`),
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: DomainError.invariant(`AI Reporter returned ${response.status} for ${path}`),
      };
    }
    try {
      return ok((await response.json()) as T);
    } catch {
      return { ok: false, error: DomainError.invariant(`AI Reporter returned malformed JSON for ${path}`) };
    }
  }

  draftSection(request: AiReporterSectionRequest): Promise<Result<AiReporterSectionResponse, DomainError>> {
    return this.post<AiReporterSectionResponse>("/v1/ai-reporter/section", request);
  }

  rewriteSection(request: AiReporterRewriteRequest): Promise<Result<AiReporterRewriteResponse, DomainError>> {
    return this.post<AiReporterRewriteResponse>("/v1/ai-reporter/rewrite", request);
  }

  async health(): Promise<Result<{ ok: boolean }, DomainError>> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/ai-reporter/health`, { signal: AbortSignal.timeout(5000) });
      return { ok: true, value: { ok: response.ok } };
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(`AI Reporter health check failed: ${error instanceof Error ? error.message : String(error)}`),
      };
    }
  }
}
