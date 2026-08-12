import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type LogframeLevel = "GOAL" | "OUTCOME" | "OUTPUT" | "ACTIVITY";

export const LOGFRAME_LEVELS: LogframeLevel[] = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];

export interface LogframeItemProps {
  parentId?: string;
  level: LogframeLevel;
  code?: string;
  title: string;
  description?: string;
}

export class LogframeItem extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: LogframeItemProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    parentId?: string;
    level: LogframeLevel;
    code?: string;
    title: string;
    description?: string;
  }): LogframeItem {
    if (!LOGFRAME_LEVELS.includes(input.level)) throw DomainError.validation("Invalid logframe level");
    if (!input.title || input.title.trim().length < 2) throw DomainError.validation("Logframe title required");
    return new LogframeItem(input.id, input.tenantId, input.projectId, {
      parentId: input.parentId,
      level: input.level,
      code: input.code,
      title: input.title.trim(),
      description: input.description,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: LogframeItemProps;
    createdAt: Date;
  }): LogframeItem {
    return new LogframeItem(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get parentId(): string | undefined { return this.props.parentId; }
  get level(): LogframeLevel { return this.props.level; }
  get code(): string | undefined { return this.props.code; }
  get title(): string { return this.props.title; }
  get description(): string | undefined { return this.props.description; }

  update(patch: Partial<LogframeItemProps>): void {
    this.props = { ...this.props, ...patch };
    this.touch();
  }
}
