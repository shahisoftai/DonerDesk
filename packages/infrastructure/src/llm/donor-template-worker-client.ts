import { DomainError, type Result } from "@donordesk/domain";
import type { IDonorTemplateRenderer } from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

/**
 * HTTP transport for the Python worker's donor-template docxtpl routes.
 * Same process/port as the AI Reporter worker (both are FastAPI routers
 * mounted on the one worker app) — reuses `AI_REPORTER_URL`/`INTERNAL_TOKEN`
 * rather than inventing a second worker-location env var. Mirrors
 * `HttpWorkerClient`'s never-throw, `Result`-returning shape so callers
 * (`buildDonorTemplate`) can always fall back to the generic-DOCX path on
 * any failure.
 */
export const DONOR_TEMPLATE_DEFAULT_URL = "http://127.0.0.1:8092";
export const DONOR_TEMPLATE_DEFAULT_TIMEOUT_MS = 60_000;

export class HttpDonorTemplateWorkerClient implements IDonorTemplateRenderer {
  readonly baseUrl: string;
  readonly timeoutMs: number;

  constructor(
    baseUrl: string | undefined = process.env.AI_REPORTER_URL ?? DONOR_TEMPLATE_DEFAULT_URL,
    timeoutMs: number | string = process.env.DONOR_TEMPLATE_RENDER_TIMEOUT_MS ?? DONOR_TEMPLATE_DEFAULT_TIMEOUT_MS,
    private readonly internalToken: string = process.env.INTERNAL_TOKEN ?? "",
  ) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    const parsed = Number(timeoutMs);
    this.timeoutMs = Number.isFinite(parsed) && parsed > 0 ? parsed : DONOR_TEMPLATE_DEFAULT_TIMEOUT_MS;
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
      return { ok: false, error: DomainError.invariant(`Donor template worker request failed (url=${this.baseUrl}): ${error instanceof Error ? error.message : String(error)}`) };
    }
    if (!response.ok) {
      return { ok: false, error: DomainError.invariant(`Donor template worker returned ${response.status} for ${path} (url=${this.baseUrl})`) };
    }
    try {
      return ok((await response.json()) as T);
    } catch {
      return { ok: false, error: DomainError.invariant(`Donor template worker returned malformed JSON for ${path} (url=${this.baseUrl})`) };
    }
  }

  async insertPlaceholders(input: {
    originalDocxBuffer: Buffer;
    regions: Array<{ id: string; kind: "HEADING" | "TABLE"; order: number; placeholderKey: string }>;
  }): Promise<Result<{ templatedDocxBuffer: Buffer }, DomainError>> {
    const result = await this.post<{ templatedDocxBase64: string }>("/v1/donor-template/insert-placeholders", {
      originalDocxBase64: input.originalDocxBuffer.toString("base64"),
      regions: input.regions,
    });
    if (!result.ok) return result;
    return ok({ templatedDocxBuffer: Buffer.from(result.value.templatedDocxBase64, "base64") });
  }

  async render(input: { templatedDocxBuffer: Buffer; context: Record<string, string> }): Promise<Result<{ renderedDocxBuffer: Buffer }, DomainError>> {
    const result = await this.post<{ renderedDocxBase64: string }>("/v1/donor-template/render", {
      templatedDocxBase64: input.templatedDocxBuffer.toString("base64"),
      context: input.context,
    });
    if (!result.ok) return result;
    return ok({ renderedDocxBuffer: Buffer.from(result.value.renderedDocxBase64, "base64") });
  }
}
