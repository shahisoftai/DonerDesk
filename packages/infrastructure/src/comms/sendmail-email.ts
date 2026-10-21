import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EmailAdapter, type EmailConfig } from "./email.js";
import type { EmailMessage, CommsResult } from "./types.js";

const header = (value: string): string => value.replace(/[\r\n]+/g, " ").trim();
const encodeWord = (value: string): string => (/^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`);
const base64Lines = (value: string): string => (Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");

/** Builds a multipart/alternative message with a text and an HTML part. Header values never carry a line break. */
export function buildMimeMessage(message: EmailMessage, from: string, domain: string): string {
  const boundary = `dd-${randomUUID()}`;
  const text = message.text ?? message.html.replace(/<[^>]+>/g, "");
  return [
    `From: ${header(from)}`,
    `To: ${header(message.to)}`,
    `Subject: ${encodeWord(header(message.subject))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(message.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/**
 * Sends through the host's own mail system (`sendmail -t -i`, Exim on the production host), which signs with the domain's DKIM key.
 * It takes the place of the Postmark adapter wherever one is used, so no outside sender is needed.
 */
export class SendmailEmailAdapter extends EmailAdapter {
  private readonly sender: EmailConfig;

  constructor(
    config: Pick<EmailConfig, "fromAddress" | "fromName">,
    private readonly sendmailPath = process.env.SENDMAIL_PATH ?? "/usr/sbin/sendmail",
  ) {
    const full: EmailConfig = { smtpHost: "", smtpPort: 0, smtpUser: "", smtpPassword: "", ...config };
    super(full);
    this.sender = full;
  }

  override async send(message: EmailMessage): Promise<CommsResult> {
    const address = this.sender.fromAddress;
    const from = message.from ?? `${encodeWord(header(this.sender.fromName ?? "DonorDesk"))} <${address}>`;
    const mime = buildMimeMessage(message, from, address.split("@")[1] ?? "localhost");
    return new Promise<CommsResult>((resolve) => {
      let stderr = "";
      const child = spawn(this.sendmailPath, ["-t", "-i", "-f", address], { stdio: ["pipe", "ignore", "pipe"] });
      child.stderr.on("data", (d) => (stderr += String(d)));
      child.on("error", (err) => resolve({ success: false, error: String(err) }));
      child.on("close", (code) => resolve(code === 0 ? { success: true } : { success: false, error: stderr.trim() || `sendmail exited ${code}` }));
      child.stdin.end(mime);
    });
  }
}
