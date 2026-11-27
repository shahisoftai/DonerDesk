import { StatsSourceNotConfigured } from "@donordesk/application";

export interface ServiceAccountKey {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
}

const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";

/**
 * Reads the JSON key file Google gives for a service account. The message of a refusal never repeats the file's
 * content, so a key can never reach a log or the Superadmin page through an error.
 */
export function parseServiceAccountKey(json: string): ServiceAccountKey {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new StatsSourceNotConfigured("The Google key file is not valid JSON.");
  }
  const clientEmail = raw.client_email;
  const privateKey = raw.private_key;
  if (raw.type !== "service_account" || typeof clientEmail !== "string" || typeof privateKey !== "string" || !privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new StatsSourceNotConfigured("The Google key file is not a service account key.");
  }
  const tokenUri = typeof raw.token_uri === "string" && raw.token_uri === GOOGLE_TOKEN_URI ? raw.token_uri : GOOGLE_TOKEN_URI;
  return { clientEmail, privateKey, tokenUri };
}
