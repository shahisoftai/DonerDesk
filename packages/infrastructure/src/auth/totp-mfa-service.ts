import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IMfaService } from "@donordesk/application";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
const CHALLENGE_TTL_SECONDS = 5 * 60;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | B32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** RFC 4226 HOTP (HMAC-SHA1, dynamic truncation) for one counter value. */
export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(message).digest();
  const offset = (hmac[hmac.length - 1] as number) & 0x0f;
  const binary =
    (((hmac[offset] as number) & 0x7f) << 24) | (((hmac[offset + 1] as number) & 0xff) << 16) | (((hmac[offset + 2] as number) & 0xff) << 8) | ((hmac[offset + 3] as number) & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export const timeStep = (at: Date): number => Math.floor(at.getTime() / 1000 / STEP_SECONDS);

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const b64 = (buffer: Buffer): string => buffer.toString("base64url");

/** The key that seals stored secrets. Fails closed in production: there is no default there. */
function encryptionKey(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY ?? process.env.PLATFORM_MASTER_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") throw new Error("MFA_ENCRYPTION_KEY (or PLATFORM_MASTER_KEY) is required to use multi-factor sign-in");
    return createHash("sha256").update("development-only-mfa-key").digest();
  }
  return createHash("sha256").update(`mfa-secret:${raw}`).digest();
}

function challengeKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return createHash("sha256").update(`mfa-challenge:${secret}`).digest();
}

/**
 * Time-based one-time passwords (RFC 6238) for tenant users, with no new dependency. Secrets are stored sealed with
 * AES-256-GCM; recovery codes are stored as hashes; the "password was right, now the code" step is a short, signed,
 * single-purpose challenge that the API's bearer-token check does not accept as a session.
 */
export class TotpMfaService implements IMfaService {
  newSecret(): string {
    return base32Encode(randomBytes(20));
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return `v1.${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(body)}`;
  }

  decrypt(encrypted: string): string {
    const [version, iv, tag, body] = encrypted.split(".");
    if (version !== "v1" || !iv || !tag || !body) throw new Error("Unreadable multi-factor secret");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  }

  matchingStep(secret: string, code: string, now: Date): number | null {
    const digits = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(digits)) return null;
    const key = base32Decode(secret);
    const current = timeStep(now);
    // One step either side: a clock a little off, or a code typed as the step rolls over.
    for (const step of [current, current - 1, current + 1]) {
      if (safeEqual(hotp(key, step), digits)) return step;
    }
    return null;
  }

  otpauthUri(secret: string, account: string, issuer: string): string {
    const label = encodeURIComponent(`${issuer}:${account}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
  }

  newRecoveryCodes(): { codes: string[]; hashes: string[] } {
    const codes = Array.from({ length: 8 }, () => {
      const raw = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase();
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
    return { codes, hashes: codes.map((c) => this.hashRecoveryCode(c)) };
  }

  hashRecoveryCode(code: string): string {
    return createHash("sha256").update(`mfa-recovery:${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`).digest("hex");
  }

  issueChallenge(userId: string, tenantId: string, now: Date): string {
    const payload = b64(Buffer.from(JSON.stringify({ u: userId, t: tenantId, e: Math.floor(now.getTime() / 1000) + CHALLENGE_TTL_SECONDS, p: "mfa" })));
    return `${payload}.${b64(createHmac("sha256", challengeKey()).update(payload).digest())}`;
  }

  readChallenge(token: string, now: Date): { userId: string; tenantId: string } | null {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = b64(createHmac("sha256", challengeKey()).update(payload).digest());
    if (!safeEqual(signature, expected)) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: string; t?: string; e?: number; p?: string };
      if (data.p !== "mfa" || !data.u || !data.t || typeof data.e !== "number" || data.e < Math.floor(now.getTime() / 1000)) return null;
      return { userId: data.u, tenantId: data.t };
    } catch {
      return null;
    }
  }
}
