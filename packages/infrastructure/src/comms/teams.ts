import type { ChannelMessage, CommsResult } from "./types.js";

export interface TeamsConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  webhookUrl?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export class TeamsAdapter {
  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: TeamsConfig) {
    if (!config.tenantId.trim() || !config.clientId.trim() || !config.clientSecret.trim()) {
      throw new Error("Microsoft Teams tenant, client ID, and client secret are required");
    }
    this.tenantId = config.tenantId;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const response = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) throw new Error(`Microsoft identity returned HTTP ${response.status}`);

    const data = await response.json() as TokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }

  async sendMessage(teamId: string, channelId: string, message: ChannelMessage): Promise<CommsResult> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            body: {
              contentType: "html",
              content: `<p>${this.escapeHtml(message.text)}</p>`,
            },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!response.ok) {
        return { success: false, error: `Microsoft Graph returned HTTP ${response.status}` };
      }

      const data = await response.json() as { id?: string };
      return { success: true, messageId: data.id ?? undefined };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async sendDirectMessage(userId: string, text: string): Promise<CommsResult> {
    try {
      const token = await this.getAccessToken();

      const chatResponse = await fetch("https://graph.microsoft.com/v1.0/chats", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatType: "oneOnOne",
          members: [{
            "@odata.type": "#microsoft.graph.aadUserConversationMember",
            roles: ["owner"],
            "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${userId.replace(/'/g, "''")}')`,
          }],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!chatResponse.ok) {
        return { success: false, error: `Microsoft Graph returned HTTP ${chatResponse.status}` };
      }

      const chat = await chatResponse.json() as { id?: string };
      if (!chat.id) {
        return { success: false, error: "Failed to create chat" };
      }

      const messageResponse = await fetch(
        `https://graph.microsoft.com/v1.0/chats/${chat.id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            body: {
              contentType: "html",
              content: `<p>${this.escapeHtml(text)}</p>`,
            },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!messageResponse.ok) {
        return { success: false, error: `Microsoft Graph returned HTTP ${messageResponse.status}` };
      }

      const data = await messageResponse.json() as { id?: string };
      return { success: true, messageId: data.id ?? undefined };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
