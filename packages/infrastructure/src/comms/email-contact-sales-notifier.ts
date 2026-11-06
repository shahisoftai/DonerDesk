import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { IContactSalesNotifier, ContactSalesInquiry } from "@donordesk/application";
import type { EmailAdapter } from "./email.js";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Mails an Enterprise inquiry to the sales inbox through Postmark; a send failure is reported to the visitor. */
export class EmailContactSalesNotifier implements IContactSalesNotifier {
  constructor(
    private readonly email: Pick<EmailAdapter, "send">,
    private readonly inbox: string,
  ) {}

  async notify(inquiry: ContactSalesInquiry): Promise<Result<void, DomainError>> {
    const text = `Name: ${inquiry.name}\nEmail: ${inquiry.email}\nOrganization: ${inquiry.organization}\n\n${inquiry.message}`;
    const sent = await this.email.send({
      to: this.inbox,
      subject: `Enterprise inquiry from ${inquiry.organization}`,
      html: `<pre style="font-family:inherit">${escapeHtml(text)}</pre>`,
      text,
    });
    if (!sent.success) {
      return { ok: false, error: DomainError.billingProviderUnavailable("We could not send your message. Please try again later.") };
    }
    return { ok: true, value: undefined };
  }
}
