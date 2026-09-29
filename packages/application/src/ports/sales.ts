import type { Result } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";

export interface ContactSalesInquiry {
  name: string;
  email: string;
  organization: string;
  message: string;
}

/**
 * Sends an Enterprise sales inquiry to the sales team. Console-email adapter
 * (log-based) is the dev default per Feature 19's Phase 1 deviations; a real
 * provider (Postmark, etc.) can implement the same port in production.
 */
export interface IContactSalesNotifier {
  notify(inquiry: ContactSalesInquiry): Promise<Result<void, DomainError>>;
}
