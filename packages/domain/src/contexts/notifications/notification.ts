import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type NotificationType =
  | "ASSIGNMENT"
  | "EVIDENCE_REVIEW"
  | "DEADLINE_REMINDER"
  | "COMMENT_MENTION"
  | "CHECKLIST_ASSIGNED"
  | "REPORT_APPROVED"
  | "REPORT_RETURNED"
  | "EXPORT_COMPLETED"
  | "INVITATION"
  | "PASSWORD_RESET";

export const NOTIFICATION_TYPES: NotificationType[] = [
  "ASSIGNMENT",
  "EVIDENCE_REVIEW",
  "DEADLINE_REMINDER",
  "COMMENT_MENTION",
  "CHECKLIST_ASSIGNED",
  "REPORT_APPROVED",
  "REPORT_RETURNED",
  "EXPORT_COMPLETED",
  "INVITATION",
  "PASSWORD_RESET",
];

export interface NotificationProps {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  read: boolean;
}

export class Notification extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    private props: NotificationProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    recipientId: string;
    type: NotificationType;
    title: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Notification {
    if (!NOTIFICATION_TYPES.includes(input.type)) throw DomainError.validation("Invalid notification type");
    return new Notification(input.id, input.tenantId, {
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      read: false,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    props: NotificationProps;
    createdAt: Date;
  }): Notification {
    return new Notification(input.id, input.tenantId, input.props, input.createdAt);
  }

  get recipientId(): string { return this.props.recipientId; }
  get type(): NotificationType { return this.props.type; }
  get title(): string { return this.props.title; }
  get message(): string { return this.props.message; }
  get relatedEntityType(): string | undefined { return this.props.relatedEntityType; }
  get relatedEntityId(): string | undefined { return this.props.relatedEntityId; }
  get read(): boolean { return this.props.read; }

  markRead(): void {
    this.props.read = true;
    this.touch();
  }
}
