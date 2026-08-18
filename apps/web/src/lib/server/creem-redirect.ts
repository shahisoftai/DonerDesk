import { createHash } from "node:crypto";

/**
 * Verifies the signature Creem appends to the success-URL redirect (see
 * docs.creem.io checkout-api "Verifying Redirect Signatures").
 *
 * The signature is a SHA-256 hex digest of the redirect parameters joined with
 * `|`, in the order they appear in the URL, with `salt={apiKey}` appended.
 * Parameters with null/empty values are excluded.
 */
export function verifyCreemRedirectSignature(rawQuery: string, apiKey: string): boolean {
  if (!rawQuery || !apiKey) return false;
  const params = new URLSearchParams(rawQuery);
  let signature = "";
  const parts: string[] = [];
  for (const [key, value] of params) {
    if (key === "signature") {
      signature = value;
      continue;
    }
    if (value === "" || value === "null") continue;
    parts.push(`${key}=${value}`);
  }
  if (!signature) return false;
  parts.push(`salt=${apiKey}`);
  const expected = createHash("sha256").update(parts.join("|")).digest("hex");
  return expected === signature;
}
