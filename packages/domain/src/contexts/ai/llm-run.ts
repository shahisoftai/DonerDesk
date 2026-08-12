import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type LlmRunStatus = "success" | "error" | "timeout";

export interface LlmRunProps {
  modelId: string;
  promptId: string;
  tenantId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  status: LlmRunStatus;
  errorMessage?: string;
  responseText?: string;
  promptVersion: number;
  modelVersion: string;
}

export class LlmRun extends Entity<string> {
  private constructor(
    id: string,
    private props: LlmRunProps,
    createdAt: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    props: LlmRunProps;
  }): LlmRun {
    if (!input.props.modelId) throw DomainError.validation("Model ID required");
    if (!input.props.promptId) throw DomainError.validation("Prompt ID required");
    if (!input.props.tenantId) throw DomainError.validation("Tenant ID required");
    for (const [name, value] of Object.entries({
      inputTokens: input.props.inputTokens,
      outputTokens: input.props.outputTokens,
      totalTokens: input.props.totalTokens,
      costUsd: input.props.costUsd,
      latencyMs: input.props.latencyMs,
    })) {
      if (!Number.isFinite(value) || value < 0) throw DomainError.validation(`${name} must be non-negative`);
    }
    if (input.props.totalTokens !== input.props.inputTokens + input.props.outputTokens) {
      throw DomainError.validation("Total tokens must equal input plus output tokens");
    }
    if (input.props.promptVersion < 1) throw DomainError.validation("Prompt version must be positive");
    if (!input.props.modelVersion) throw DomainError.validation("Model version required");
    return new LlmRun(input.id, input.props, new Date());
  }

  static rehydrate(input: {
    id: string;
    props: LlmRunProps;
    createdAt: Date;
  }): LlmRun {
    const run = LlmRun.create({ id: input.id, props: input.props });
    return new LlmRun(run.id, input.props, input.createdAt);
  }

  get modelId(): string { return this.props.modelId; }
  get promptId(): string { return this.props.promptId; }
  get tenantId(): string { return this.props.tenantId; }
  get inputTokens(): number { return this.props.inputTokens; }
  get outputTokens(): number { return this.props.outputTokens; }
  get totalTokens(): number { return this.props.totalTokens; }
  get costUsd(): number { return this.props.costUsd; }
  get latencyMs(): number { return this.props.latencyMs; }
  get status(): LlmRunStatus { return this.props.status; }
  get errorMessage(): string | undefined { return this.props.errorMessage; }
  get responseText(): string | undefined { return this.props.responseText; }
  get promptVersion(): number { return this.props.promptVersion; }
  get modelVersion(): string { return this.props.modelVersion; }

  isSuccess(): boolean {
    return this.props.status === "success";
  }
}
