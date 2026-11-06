import { connect, type Socket } from "node:net";
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

/** Reads SMTP replies line by line and hands back each complete reply (a multi-line reply ends at "NNN text"). */
class SmtpSession {
  private buffer = "";
  private waiting: ((reply: { code: number; text: string }) => void) | null = null;
  private lines: string[] = [];
  private failure: Error | null = null;

  constructor(private readonly socket: Socket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      let i: number;
      while ((i = this.buffer.indexOf("\r\n")) >= 0) {
        const line = this.buffer.slice(0, i);
        this.buffer = this.buffer.slice(i + 2);
        this.lines.push(line);
        if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) this.flush();
      }
    });
    socket.on("error", (err) => this.fail(err));
    socket.on("close", () => this.fail(new Error("connection closed")));
  }

  private fail(err: Error): void {
    this.failure = err;
    this.waiting?.({ code: 0, text: err.message });
    this.waiting = null;
  }

  private flush(): void {
    if (!this.waiting) return;
    const text = this.lines.join("\n");
    this.lines = [];
    const resolve = this.waiting;
    this.waiting = null;
    resolve({ code: Number(text.slice(0, 3)), text });
  }

  reply(): Promise<{ code: number; text: string }> {
    if (this.failure) return Promise.resolve({ code: 0, text: this.failure.message });
    return new Promise((resolve) => {
      this.waiting = resolve;
      if (this.lines.length && /^\d{3}( |$)/.test(this.lines[this.lines.length - 1]!)) this.flush();
    });
  }

  async command(line: string): Promise<{ code: number; text: string }> {
    this.socket.write(`${line}\r\n`);
    return this.reply();
  }
}

/**
 * Sends through the host's own mail server over SMTP on the loopback interface (Exim on the production host, which signs with the
 * domain's DKIM key and delivers). No outside sender, no credentials, and nothing that needs privileges inside the service sandbox.
 */
export class LocalSmtpEmailAdapter extends EmailAdapter {
  private readonly sender: EmailConfig;

  constructor(
    config: Pick<EmailConfig, "fromAddress" | "fromName">,
    private readonly host = process.env.SMTP_HOST ?? "127.0.0.1",
    private readonly port = Number(process.env.SMTP_PORT ?? 25),
    private readonly timeoutMs = 15000,
  ) {
    const full: EmailConfig = { smtpHost: "", smtpPort: 0, smtpUser: "", smtpPassword: "", ...config };
    super(full);
    this.sender = full;
  }

  override async send(message: EmailMessage): Promise<CommsResult> {
    const address = this.sender.fromAddress;
    const recipient = header(message.to).replace(/^.*<([^>]+)>.*$/, "$1");
    const from = message.from ?? `${encodeWord(header(this.sender.fromName ?? "DonorDesk"))} <${address}>`;
    const domain = address.split("@")[1] ?? "localhost";
    const mime = buildMimeMessage(message, from, domain).replace(/^\./gm, "..");
    const socket = connect({ host: this.host, port: this.port });
    socket.setTimeout(this.timeoutMs, () => socket.destroy(new Error("SMTP timeout")));
    const session = new SmtpSession(socket);
    try {
      const expect = async (step: string, reply: { code: number; text: string }, ok: number) => {
        if (reply.code !== ok) throw new Error(`${step}: ${reply.text}`);
      };
      await expect("greeting", await session.reply(), 220);
      await expect("EHLO", await session.command(`EHLO ${domain}`), 250);
      await expect("MAIL", await session.command(`MAIL FROM:<${address}>`), 250);
      await expect("RCPT", await session.command(`RCPT TO:<${recipient}>`), 250);
      await expect("DATA", await session.command("DATA"), 354);
      socket.write(`${mime}\r\n.\r\n`);
      const done = await session.reply();
      await expect("message", done, 250);
      await session.command("QUIT");
      return { success: true, messageId: done.text.split(" ").pop() };
    } catch (err) {
      return { success: false, error: String(err instanceof Error ? err.message : err) };
    } finally {
      socket.destroy();
    }
  }
}
