import type { ChannelMessage, CommsResult } from "./types.js";

export interface SlackConfig {
  botToken: string;
  defaultChannel?: string;
}

export class SlackAdapter {
  private readonly botToken: string;
  private readonly defaultChannel: string;

  constructor(config: SlackConfig) {
    if (!config.botToken.trim()) throw new Error("Slack bot token is required");
    this.botToken = config.botToken;
    this.defaultChannel = config.defaultChannel ?? "#donordesk";
  }

  async sendMessage(channel: string, message: ChannelMessage): Promise<CommsResult> {
    try {
      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          text: message.text,
          blocks: message.blocks ?? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: message.text,
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = await response.json() as { ok: boolean; ts?: string; error?: string };

      if (!data.ok) {
        return { success: false, error: data.error };
      }

      return { success: true, messageId: data.ts };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async sendDirectMessage(userId: string, text: string): Promise<CommsResult> {
    try {
      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: userId,
          text,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = await response.json() as { ok: boolean; ts?: string; error?: string };

      if (!data.ok) {
        return { success: false, error: data.error };
      }

      return { success: true, messageId: data.ts };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async lookupUserByEmail(email: string): Promise<string | null> {
    try {
      const url = new URL("https://slack.com/api/users.lookupByEmail");
      url.searchParams.set("email", email);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.botToken}`,
        },
        signal: AbortSignal.timeout(15_000),
      });

      const data = await response.json() as { ok: boolean; user?: { id: string } };

      if (!data.ok || !data.user) {
        return null;
      }

      return data.user.id;
    } catch {
      return null;
    }
  }
}
