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
 *
 * Defaults (no env vars set):
 *   - baseUrl: `http://127.0.0.1:8092` — the documented Python worker port
 *     (see `AGENTS.md` and `memorybank/imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`).
 *     The legacy `http://localhost:5000` was a stub address that has caused
 *     `ECONNREFUSED` failures when `AI_REPORTER_URL` was unset.
 *   - timeoutMs: the whole worker request, which may make TWO LLM calls (a
 *     draft plus one validator-feedback retry), each capped by the worker at
 *     `AI_REPORTER_DRAFT_TIMEOUT_MS` (default 90s). The HTTP timeout is
 *     therefore `AI_REPORTER_HTTP_TIMEOUT_MS`, defaulting to 2 x the per-call
 *     cap + 30s. It used to equal the per-call cap, so the API aborted every
 *     retry before the worker could answer.
 */
export const AI_REPORTER_DEFAULT_URL = "http://127.0.0.1:8092";
export const AI_REPORTER_DEFAULT_DRAFT_TIMEOUT_MS = 90_000;
export const AI_REPORTER_DEFAULT_TIMEOUT_MS = 2 * AI_REPORTER_DEFAULT_DRAFT_TIMEOUT_MS + 30_000;

function defaultHttpTimeoutMs(): number | string {
  if (process.env.AI_REPORTER_HTTP_TIMEOUT_MS) return process.env.AI_REPORTER_HTTP_TIMEOUT_MS;
  const perCall = Number(process.env.AI_REPORTER_DRAFT_TIMEOUT_MS);
  return Number.isFinite(perCall) && perCall > 0 ? 2 * perCall + 30_000 : AI_REPORTER_DEFAULT_TIMEOUT_MS;
}

export class HttpWorkerClient implements IWorkerClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;

  constructor(
    baseUrl: string | undefined = process.env.AI_REPORTER_URL ?? AI_REPORTER_DEFAULT_URL,
    timeoutMs: number | string = defaultHttpTimeoutMs(),
    private readonly internalToken: string = process.env.INTERNAL_TOKEN ?? "",
  ) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    const parsed = Number(timeoutMs);
    this.timeoutMs = Number.isFinite(parsed) && parsed > 0 ? parsed : AI_REPORTER_DEFAULT_TIMEOUT_MS;
  }

  /**
   * Probe the worker for liveness. Returns a typed Result so the caller can
   * log a precise reason when AI_REPORTER_ENABLED=1 is set but the worker is
   * unreachable. Does not throw.
   */
  async probe(): Promise<Result<{ ok: boolean; baseUrl: string; latencyMs: number }, DomainError>> {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/v1/ai-reporter/health`, {
        signal: AbortSignal.timeout(5000),
        headers: this.internalToken ? { "X-Internal-Token": this.internalToken } : undefined,
      });
      if (!response.ok) {
        return {
          ok: false,
          error: DomainError.invariant(`AI Reporter health probe returned ${response.status} (url=${this.baseUrl})`),
        };
      }
      return { ok: true, value: { ok: true, baseUrl: this.baseUrl, latencyMs: Date.now() - startedAt } };
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(
          `AI Reporter health probe failed (url=${this.baseUrl}): ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  }

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
        error: DomainError.invariant(`AI Reporter request failed (url=${this.baseUrl}): ${error instanceof Error ? error.message : String(error)}`),
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: DomainError.invariant(`AI Reporter returned ${response.status} for ${path} (url=${this.baseUrl})`),
      };
    }
    try {
      return ok((await response.json()) as T);
    } catch {
      return { ok: false, error: DomainError.invariant(`AI Reporter returned malformed JSON for ${path} (url=${this.baseUrl})`) };
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
