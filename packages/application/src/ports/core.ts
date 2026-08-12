import type { TenantId } from "@donordesk/domain";
import type { DomainEvent } from "@donordesk/domain";

export interface IEventBus {
  publish(events: DomainEvent[]): Promise<void>;
}

export interface IUnitOfWork {
  run<T>(work: (tx: IUnitOfWorkTx) => Promise<T>): Promise<T>;
}

export interface IUnitOfWorkTx {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface IClock {
  now(): Date;
}

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}

export interface IIdGenerator {
  generate(): string;
}

export class UuidIdGenerator implements IIdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}

export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export interface IAuditLogger {
  record(input: {
    tenantId: TenantId;
    actorId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    projectId?: string;
    oldValue?: string;
    newValue?: string;
    ipAddress?: string;
    systemNote?: string;
  }): Promise<void>;
}

export interface INotificationPort {
  notify(input: {
    tenantId: TenantId;
    recipientId: string;
    type:
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
    title: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<void>;
}
