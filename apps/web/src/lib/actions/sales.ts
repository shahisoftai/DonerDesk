"use server";

import { apiBaseUrl } from "@/lib/server/api-gateway";

export type ContactSalesResult = { ok: true } | { ok: false; error: string };

export async function submitContactSalesAction(input: {
  name: string;
  email: string;
  organization: string;
  message: string;
  website?: string;
}): Promise<ContactSalesResult> {
  try {
    const response = await fetch(`${apiBaseUrl()}/v1/contact-sales`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, error: "We could not send your message. Please email sales@donordesk.online directly." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "We could not send your message. Please email sales@donordesk.online directly." };
  }
}
