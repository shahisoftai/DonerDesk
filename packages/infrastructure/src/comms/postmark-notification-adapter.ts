import type { INotificationPort } from "@donordesk/application";
import type { IUserRepository } from "@donordesk/application";
import type { ILogger } from "@donordesk/application";
import { EmailAdapter } from "./email.js";

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
        html: `<p>${escapeHtml(input.message)}</p>`,
      });
      if (!result.success) {
        this.logger.error("notification.email_failed", { type: input.type, recipient: input.recipientId, error: result.error });
      }
    } catch (error) {
      this.logger.error("notification.email_exception", { type: input.type, recipient: input.recipientId, error: String(error) });
    }
  }
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
