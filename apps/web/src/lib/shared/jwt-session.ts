export type SessionClaims = {
  sub?: string;
  tid?: string;
  role?: string;
  name?: string;
  email?: string;
  exp?: number;
};

export function decodeSessionPayload(token: string): SessionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payloadPart = parts[1];
  if (!payloadPart) return null;
  let decoded: string;
  try {
    decoded = base64UrlDecode(payloadPart);
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(decoded) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as SessionClaims;
  } catch {
    return null;
  }
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
