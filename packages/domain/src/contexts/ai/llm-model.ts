import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type LlmProvider = "openai" | "anthropic" | "bedrock" | "ollama";
export type LlmCapability = "chat" | "embedding" | "vision";
export type Jurisdictions = "US" | "EU" | "AFRICA" | "ASIA";

export interface LlmModelProps {
  name: string;
  provider: LlmProvider;
  version: string;
  capabilities: LlmCapability[];
  costPer1kTokens: number;
  maxTokens: number;
  jurisdiction: Jurisdictions;
  isActive: boolean;
}

export class LlmModel extends Entity<string> {
  private constructor(
    id: string,
    private props: LlmModelProps,
    createdAt: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    props: LlmModelProps;
  }): LlmModel {
    LlmModel.validateProps(input.props);
    return new LlmModel(input.id, input.props, new Date());
  }

  static rehydrate(input: {
    id: string;
    props: LlmModelProps;
    createdAt: Date;
  }): LlmModel {
    LlmModel.validateProps(input.props);
    return new LlmModel(input.id, input.props, input.createdAt);
  }

  private static validateProps(p: LlmModelProps): void {
    if (!p.name) throw DomainError.validation("Model name required");
    if (!p.provider) throw DomainError.validation("Provider required");
    if (!p.capabilities.length) throw DomainError.validation("At least one capability required");
    if (!p.version.trim()) throw DomainError.validation("Model version required");
    if (!Number.isFinite(p.costPer1kTokens) || p.costPer1kTokens < 0) throw DomainError.validation("Model cost must be non-negative");
    if (!Number.isInteger(p.maxTokens) || p.maxTokens < 1) throw DomainError.validation("Maximum tokens must be a positive integer");
  }

  get name(): string { return this.props.name; }
  get provider(): LlmProvider { return this.props.provider; }
  get version(): string { return this.props.version; }
  get capabilities(): LlmCapability[] { return [...this.props.capabilities]; }
  get costPer1kTokens(): number { return this.props.costPer1kTokens; }
  get maxTokens(): number { return this.props.maxTokens; }
  get jurisdiction(): Jurisdictions { return this.props.jurisdiction; }
  get isActive(): boolean { return this.props.isActive; }

  deactivate(): void {
    this.props = { ...this.props, isActive: false };
    this.touch();
  }

  activate(): void {
    this.props = { ...this.props, isActive: true };
    this.touch();
  }
}
