import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type TaskType = "evidence_tagging" | "report_draft" | "activity_polish";

export interface LlmFeedbackProps {
  promptId: string;
  tenantId: string;
  runId?: string;
  taskType: TaskType;
  entityType?: string;
  entityId?: string;
  accepted: boolean;
  rating?: number;
  comment?: string;
  modelId?: string;
  promptVersion?: number;
}

export class LlmFeedback extends Entity<string> {
  private constructor(
    id: string,
    private props: LlmFeedbackProps,
    createdAt: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    props: LlmFeedbackProps;
  }): LlmFeedback {
    if (!input.props.promptId) throw DomainError.validation("Prompt ID required");
    if (!input.props.tenantId) throw DomainError.validation("Tenant ID required");
    if (!input.props.taskType) throw DomainError.validation("Task type required");
    if (input.props.rating !== undefined && (input.props.rating < 1 || input.props.rating > 5)) {
      throw DomainError.validation("Rating must be between 1 and 5");
    }
    return new LlmFeedback(input.id, input.props, new Date());
  }

  static rehydrate(input: {
    id: string;
    props: LlmFeedbackProps;
    createdAt: Date;
  }): LlmFeedback {
    return new LlmFeedback(input.id, input.props, input.createdAt);
  }

  get promptId(): string { return this.props.promptId; }
  get tenantId(): string { return this.props.tenantId; }
  get runId(): string | undefined { return this.props.runId; }
  get taskType(): TaskType { return this.props.taskType; }
  get entityType(): string | undefined { return this.props.entityType; }
  get entityId(): string | undefined { return this.props.entityId; }
  get accepted(): boolean { return this.props.accepted; }
  get rating(): number | undefined { return this.props.rating; }
  get comment(): string | undefined { return this.props.comment; }
  get modelId(): string | undefined { return this.props.modelId; }
  get promptVersion(): number | undefined { return this.props.promptVersion; }

  isAccepted(): boolean { return this.props.accepted; }
  isRejected(): boolean { return !this.props.accepted; }
}
