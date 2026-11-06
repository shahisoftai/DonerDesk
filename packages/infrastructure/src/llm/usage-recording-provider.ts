import { estimateCostUsd } from "@donordesk/domain";
import type { IIdGenerator, ILLMProvider, ILlmUsageRepository, LLMCompletionInput, LLMCompletionResult } from "@donordesk/application";

export interface UsageRecordingContext {
  tenantId: string;
  operationType: string;
  promptId: string;
}

/**
 * Decorator that writes one `LlmRun` row per provider call (success or error),
 * so usage outside report drafting is visible to the platform owner. It adds
 * no behaviour to the call itself: a failed ledger write is swallowed and the
 * provider's result or error passes through unchanged. Rows are never
 * billable (`billableUnits` 0); credits are charged by the drafting use case.
 */
export class UsageRecordingLlmProvider implements ILLMProvider {
  readonly name: string;
  readonly model: string;
  readonly promptVersion: string;

  constructor(
    private readonly inner: ILLMProvider,
    private readonly runs: ILlmUsageRepository,
    private readonly ids: IIdGenerator,
    private readonly context: UsageRecordingContext,
  ) {
    this.name = inner.name;
    this.model = inner.model;
    this.promptVersion = inner.promptVersion;
  }

  async complete(input: LLMCompletionInput): Promise<LLMCompletionResult> {
    const startedAt = Date.now();
    try {
      const result = await this.inner.complete(input);
      await this.record("success", startedAt, result.usage.inputTokens, result.usage.outputTokens);
      return result;
    } catch (error) {
      await this.record("error", startedAt, 0, 0, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async record(status: string, startedAt: number, inputTokens: number, outputTokens: number, errorMessage?: string): Promise<void> {
    try {
      await this.runs.recordRun({
        id: this.ids.generate(),
        tenantId: this.context.tenantId,
        operationType: this.context.operationType,
        modelId: this.model,
        promptId: this.context.promptId,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd: estimateCostUsd(this.model, inputTokens, outputTokens),
        latencyMs: Date.now() - startedAt,
        status,
        promptVersion: Number.parseInt(this.promptVersion, 10) || 1,
        modelVersion: this.model,
        billableUnits: 0,
        errorMessage: errorMessage?.slice(0, 500),
      });
    } catch {
      // The ledger must never break the call it observes.
    }
  }
}
