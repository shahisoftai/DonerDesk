import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export interface LlmPromptProps {
  name: string;
  version: number;
  promptText: string;
  variables: string[];
  modelId?: string;
  isActive: boolean;
}

export class LlmPrompt extends Entity<string> {
  private constructor(
    id: string,
    private props: LlmPromptProps,
    createdAt: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    props: LlmPromptProps;
  }): LlmPrompt {
    LlmPrompt.validateProps(input.props);
    LlmPrompt.validateProps(input.props);
    return new LlmPrompt(input.id, input.props, new Date());
  }

  static rehydrate(input: {
    id: string;
    props: LlmPromptProps;
    createdAt: Date;
  }): LlmPrompt {
    return new LlmPrompt(input.id, input.props, input.createdAt);
  }

  private static validateProps(p: LlmPromptProps): void {
    if (!p.name) throw DomainError.validation("Prompt name required");
    if (p.version < 1) throw DomainError.validation("Version must be >= 1");
    if (!p.promptText) throw DomainError.validation("Prompt text required");
  }

  get name(): string { return this.props.name; }
  get version(): number { return this.props.version; }
  get promptText(): string { return this.props.promptText; }
  get variables(): string[] { return [...this.props.variables]; }
  get modelId(): string | undefined { return this.props.modelId; }
  get isActive(): boolean { return this.props.isActive; }

  render(variables: Record<string, string>): string {
    const missing = this.props.variables.filter((key) => variables[key] === undefined);
    if (missing.length > 0) throw DomainError.validation(`Missing prompt variables: ${missing.join(", ")}`);
    let text = this.props.promptText;
    for (const key of this.props.variables) {
      text = text.split(`{{${key}}}`).join(variables[key]!);
    }
    return text;
  }

  incrementVersion(newId: string): LlmPrompt {
    if (!newId || newId === this.id) throw DomainError.validation("A new prompt ID is required for a new version");
    return LlmPrompt.create({
      id: newId,
      props: {
        ...this.props,
        version: this.props.version + 1,
      },
    });
  }

  deactivate(): void {
    this.props = { ...this.props, isActive: false };
    this.touch();
  }
}
