import type { Result } from "@donordesk/domain";
import { TenantId } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";
import type { IContactSalesNotifier, ContactSalesInquiry } from "../../ports/sales.js";
import type { IAuditLogger } from "../../ports/core.js";

/** Platform-level audit rows (no tenant yet) are recorded against this sentinel, matching ExpireLocalTrialsHandler's convention. */
const PLATFORM_TENANT_ID = { toString: () => "*" } as TenantId;

/**
 * Public (unauthenticated) Enterprise "Talk to us" intake — WS-I.1. Replaces
 * the raw `mailto:` CTA so the browser never needs the sales inbox address,
 * inquiries are audited, and basic spam protection is server-enforced.
 */
export class SubmitContactSalesInquiryHandler {
  constructor(
    private readonly notifier: IContactSalesNotifier,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(input: ContactSalesInquiry): Promise<Result<void, DomainError>> {
    const sent = await this.notifier.notify(input);
    if (!sent.ok) return sent;

    await this.audit.record({
      tenantId: PLATFORM_TENANT_ID,
      actorId: "public:contact-sales",
      eventType: "sales.contact_inquiry.submitted",
      entityType: "contact_sales_inquiry",
      entityId: input.email,
      newValue: JSON.stringify({ organization: input.organization }),
    });
    return { ok: true, value: undefined };
  }
}
