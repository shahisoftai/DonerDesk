import type { Result } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";
import type { IContactSalesNotifier, ContactSalesInquiry } from "@donordesk/application";

/**
 * Dev-default (console/log) sales-inquiry notifier — mirrors the "console
 * email" default used elsewhere in Phase 1 (see AGENTS.md). Swap for a real
 * provider (Postmark, etc.) in production by implementing the same port.
 */
export class ConsoleContactSalesNotifier implements IContactSalesNotifier {
  constructor(private readonly logger?: { info: (message: string, meta?: Record<string, unknown>) => void }) {}

  async notify(inquiry: ContactSalesInquiry): Promise<Result<void, DomainError>> {
    if (this.logger) {
      this.logger.info("Enterprise contact-sales inquiry received", { to: "sales@donordesk.online", inquiry });
    } else {
      console.info("Enterprise contact-sales inquiry received", { to: "sales@donordesk.online", inquiry });
    }
    return { ok: true, value: undefined };
  }
}
