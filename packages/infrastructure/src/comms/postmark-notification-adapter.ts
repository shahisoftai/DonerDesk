import type { INotificationPort } from "@donordesk/application";
import type { IUserRepository } from "@donordesk/application";
import type { ILogger } from "@donordesk/application";
import { EmailAdapter } from "./email.js";
import { messageBlocks } from "@donordesk/domain";

type NotifyInput = Parameters<INotificationPort["notify"]>[0];

/**
 * Translates the in-app INotificationPort shape ({type, title, message}) into
 * a real Postmark email via the existing EmailAdapter (which already made
 * real Postmark HTTP calls but was never wired into any port). Resolves the
 * recipient's email address by userId since the port only carries an id.
 * Failures are logged, never thrown — email delivery is additive and must
 * never block or fail the caller's underlying action (e.g. an assignment or
 * password reset that already succeeded).
 */
export class PostmarkNotificationAdapter implements INotificationPort {
  constructor(
    private readonly email: EmailAdapter,
    private readonly users: IUserRepository,
    private readonly logger: ILogger,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    try {
      const userResult = await this.users.findByIdGlobal(input.recipientId);
      if (!userResult.ok || !userResult.value) return;
      const recipient = userResult.value;

      const result = await this.email.send({
        to: recipient.email.toString(),
        subject: input.title,
        html: messageHtml(input.emailLink ? `${input.message}\n\n${input.emailLink}` : input.message, input.emailLink),
      });
      if (!result.success) {
        this.logger.error("notification.email_failed", { type: input.type, recipient: input.recipientId, error: result.error });
      }
    } catch (error) {
      this.logger.error("notification.email_exception", { type: input.type, recipient: input.recipientId, error: String(error) });
    }
  }
}

/** Headings, bullet lists and paragraphs, read by the same rule as the Inbox (`messageBlocks`). */
function messageHtml(text: string, link?: string): string {
  const linkHtml = (t: string): string => (link && t === link ? `<p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>` : null) ?? `<p>${escapeHtml(t)}</p>`;
  return messageBlocks(text)
    .map((b) =>
      b.kind === "LIST"
        ? `<ul>${b.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : b.kind === "HEADING"
          ? `<p><strong>${escapeHtml(b.text)}</strong></p>`
          : linkHtml(b.text),
    )
    .join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Fans a notification out to every wired adapter (e.g. in-app log + email),
 * so enabling email delivery is additive: the in-app path is never removed,
 * and one adapter's failure never blocks another's.
 */
export class FanOutNotificationAdapter implements INotificationPort {
  constructor(private readonly adapters: INotificationPort[]) {}

  async notify(input: NotifyInput): Promise<void> {
    await Promise.all(this.adapters.map((a) => a.notify(input)));
  }
}
