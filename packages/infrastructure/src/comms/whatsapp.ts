import type { WhatsAppMessage, CommsResult } from "./types.js";

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
}

interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export class WhatsAppAdapter {
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(config: WhatsAppConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
  }

  async sendMessage(message: WhatsAppMessage): Promise<CommsResult> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: message.to,
            type: "template",
            template: {
              name: message.template,
              language: { code: "en" },
              components: [
                {
                  type: "body",
                  parameters: Object.entries(message.variables).map(([key, value]) => ({
                    type: "text",
                    text: value,
                  })),
                },
              ],
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data = await response.json() as WhatsAppResponse;

      if (data.messages && data.messages[0]) {
        return { success: true, messageId: data.messages[0].id };
      }

      return { success: false, error: "No message ID returned" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async sendTextMessage(to: string, text: string): Promise<CommsResult> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: text },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data = await response.json() as WhatsAppResponse;

      if (data.messages && data.messages[0]) {
        return { success: true, messageId: data.messages[0].id };
      }

      return { success: false, error: "No message ID returned" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
