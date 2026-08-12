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

export interface NotificationPayload {
  tenantId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  expiresAt?: Date;
}

export interface ChannelMessage {
  channel: string;
  text: string;
  blocks?: Array<{
    type: string;
    text?: { type: string; text: string };
  }>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface WhatsAppMessage {
  to: string;
  template: string;
  variables: Record<string, string>;
}

export interface CommsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
