import type { IEventBus, IAuditLogger, INotificationPort, ILogger } from "@donordesk/application";
import type { DomainEvent, TenantId } from "@donordesk/domain";

export class LoggingEventBus implements IEventBus {
  constructor(private readonly logger: ILogger) {}
  async publish(events: DomainEvent[]): Promise<void> {
    for (const e of events) {
      this.logger.info("domain.event", { eventName: e.eventName, eventId: e.eventId });
    }
  }
}

export class LoggingNotificationAdapter implements INotificationPort {
  constructor(private readonly logger: ILogger) {}
  async notify(input: {
    tenantId: TenantId;
    recipientId: string;
    type: "ASSIGNMENT" | "EVIDENCE_REVIEW" | "DEADLINE_REMINDER" | "COMMENT_MENTION" | "CHECKLIST_ASSIGNED" | "REPORT_APPROVED" | "REPORT_RETURNED" | "EXPORT_COMPLETED" | "INVITATION" | "PASSWORD_RESET";
    title: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<void> {
    this.logger.info("notification", { type: input.type, title: input.title, recipient: input.recipientId });
  }
}

export class NoopAuditLogger implements IAuditLogger {
  async record(_input: Parameters<IAuditLogger["record"]>[0]): Promise<void> {
    // The PrismaAuditRepository is the real implementation; this is the safety fallback.
  }
}

export class InMemoryJobQueue {
  private readonly handler: (name: string, payload: Record<string, unknown>) => Promise<void>;
  constructor(handler: (name: string, payload: Record<string, unknown>) => Promise<void>) {
    this.handler = handler;
  }
  async enqueue(name: string, payload: Record<string, unknown>): Promise<void> {
    setImmediate(() => {
      this.handler(name, payload).catch(() => undefined);
    });
  }
}

export class SimplePiiRedactor {
  private readonly patterns: Array<{ re: RegExp; replacement: string }> = [
    { re: /[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, replacement: "[EMAIL]" },
    { re: /\+?\d[\d\s().-]{7,}\d/g, replacement: "[PHONE]" },
    { re: /\b\d{5}-?\d{7}-?\d\b/g, replacement: "[ID]" },
    { re: /\b\d{4} ?\d{4} ?\d{4} ?\d{4}\b/g, replacement: "[CARD]" },
  ];
  redact(text: string): { redacted: string; redactionCount: number } {
    let count = 0;
    let out = text;
    for (const p of this.patterns) {
      out = out.replace(p.re, (match) => {
        count++;
        return p.replacement;
      });
    }
    return { redacted: out, redactionCount: count };
  }
}
