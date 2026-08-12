import type { EmailMessage, CommsResult } from "./types.js";

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromAddress: string;
  fromName?: string;
  useTLS?: boolean;
}

export class EmailAdapter {
  private readonly config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  async send(message: EmailMessage): Promise<CommsResult> {
    try {
      const envelope = {
        from: message.from ?? `${this.config.fromName ?? "DonorDesk"} <${this.config.fromAddress}>`,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text ?? this.htmlToPlain(message.html),
      };

      const response = await fetch(`https://api.postmarkapp.com/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": this.config.smtpUser,
        },
        body: JSON.stringify({
          From: envelope.from,
          To: envelope.to,
          Subject: envelope.subject,
          HtmlBody: envelope.html,
          TextBody: envelope.text,
          MessageStream: "outbound",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data = await response.json() as { MessageID?: string; ErrorCode?: number; Message?: string };

      if (data.ErrorCode && data.ErrorCode !== 0) {
        return { success: false, error: data.Message ?? `Postmark error ${data.ErrorCode}` };
      }

      return { success: true, messageId: data.MessageID };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async sendTemplatedEmail(
    to: string,
    templateId: number,
    variables: Record<string, string>,
  ): Promise<CommsResult> {
    try {
      const response = await fetch(`https://api.postmarkapp.com/email/withTemplate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": this.config.smtpUser,
        },
        body: JSON.stringify({
          To: to,
          TemplateId: templateId,
          TemplateModel: variables,
          MessageStream: "outbound",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data = await response.json() as { MessageID?: string; ErrorCode?: number; Message?: string };

      if (data.ErrorCode && data.ErrorCode !== 0) {
        return { success: false, error: data.Message ?? `Postmark error ${data.ErrorCode}` };
      }

      return { success: true, messageId: data.MessageID };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  private htmlToPlain(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }
}
