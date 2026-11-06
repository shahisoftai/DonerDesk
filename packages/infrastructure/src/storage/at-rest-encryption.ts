import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { IStorage, StoragePutInput, StoragePutResult } from "@donordesk/application";

/**
 * Application-level encryption of stored files (evidence, exports, templates) at rest: AES-256-GCM with a key per organisation,
 * derived from a master key, so a copy of the storage directory (a backup, a disk image) is unreadable without the master key.
 *
 * File layout: `DDENC1` | key id (1 byte) | IV (12) | GCM tag (16) | ciphertext. The storage key is bound in as authenticated
 * data, so a file moved or copied to another key fails to decrypt instead of being served as someone else's. A file without the
 * `DDENC1` prefix is an older plaintext file and is returned as it is, so turning encryption on never makes existing files unreadable;
 * `encryptStorageTree` brings them over.
 */
const MAGIC = Buffer.from("DDENC1", "ascii");
const HEADER = MAGIC.length + 1 + 12 + 16;

export interface Keyring {
  /** Master keys by id (1 to 255), 32 bytes each. A retired key stays here so files written with it still open. */
  keys: ReadonlyMap<number, Buffer>;
  /** The key new files are written with. */
  activeId: number;
}

/** Reads `EVIDENCE_ENCRYPTION_KEYS` (`1:<base64>,2:<base64>`) and `EVIDENCE_ENCRYPTION_ACTIVE` (default: the highest id). Null when unset. */
export function keyringFromEnv(env: NodeJS.ProcessEnv = process.env): Keyring | null {
  const raw = env.EVIDENCE_ENCRYPTION_KEYS?.trim();
  if (!raw) return null;
  const keys = new Map<number, Buffer>();
  for (const part of raw.split(",")) {
    const [id, value] = part.trim().split(":");
    const n = Number(id);
    const key = Buffer.from(value ?? "", "base64");
    if (!Number.isInteger(n) || n < 1 || n > 255) throw new Error("EVIDENCE_ENCRYPTION_KEYS: a key id must be a whole number from 1 to 255");
    if (key.length !== 32) throw new Error(`EVIDENCE_ENCRYPTION_KEYS: key ${id} must be 32 bytes, base64-encoded`);
    keys.set(n, key);
  }
  const activeId = env.EVIDENCE_ENCRYPTION_ACTIVE ? Number(env.EVIDENCE_ENCRYPTION_ACTIVE) : Math.max(...keys.keys());
  if (!keys.has(activeId)) throw new Error("EVIDENCE_ENCRYPTION_ACTIVE names a key that is not in EVIDENCE_ENCRYPTION_KEYS");
  return { keys, activeId };
}

/** The organisation a storage key belongs to: keys are written as `<tenantId>/...`. Anything else shares one fallback scope. */
const scopeOf = (storageKey: string): string => storageKey.split("/")[0] || "global";

function dataKey(master: Buffer, storageKey: string): Buffer {
  return Buffer.from(hkdfSync("sha256", master, Buffer.from(scopeOf(storageKey), "utf8"), "donordesk-file-encryption-v1", 32));
}

export const isEncrypted = (data: Buffer): boolean => data.length >= HEADER && data.subarray(0, MAGIC.length).equals(MAGIC);

export function encryptFile(plain: Buffer, storageKey: string, ring: Keyring): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey(ring.keys.get(ring.activeId)!, storageKey), iv);
  cipher.setAAD(Buffer.from(storageKey, "utf8"));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, Buffer.from([ring.activeId]), iv, cipher.getAuthTag(), body]);
}

/** Opens an encrypted file. Throws when the key is unknown or the bytes or the storage key were changed. */
export function decryptFile(data: Buffer, storageKey: string, ring: Keyring): Buffer {
  const keyId = data[MAGIC.length]!;
  const master = ring.keys.get(keyId);
  if (!master) throw new Error(`This file was encrypted with key ${keyId}, which is not configured.`);
  const iv = data.subarray(MAGIC.length + 1, MAGIC.length + 13);
  const tag = data.subarray(MAGIC.length + 13, HEADER);
  const decipher = createDecipheriv("aes-256-gcm", dataKey(master, storageKey), iv);
  decipher.setAAD(Buffer.from(storageKey, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data.subarray(HEADER)), decipher.final()]);
}

/** Encrypts what an inner storage writes and decrypts what it reads. Reports the size of the file as the person uploaded it. */
export class EncryptedStorage implements IStorage {
  constructor(private readonly inner: IStorage, private readonly ring: Keyring) {}

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const stored = await this.inner.put({ ...input, body: encryptFile(Buffer.from(input.body), input.key, this.ring) });
    return { ...stored, size: input.body.length };
  }

  async read(key: string): Promise<Buffer> {
    const data = await this.inner.read(key);
    return isEncrypted(data) ? decryptFile(data, key, this.ring) : data;
  }

  getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    return this.inner.getSignedUrl(key, ttlSeconds);
  }

  remove(key: string): Promise<void> {
    return this.inner.remove(key);
  }
}

/** Wraps a storage with encryption when a keyring is configured; otherwise returns it untouched. */
export function withEncryptionAtRest(storage: IStorage, ring: Keyring | null = keyringFromEnv()): IStorage {
  return ring ? new EncryptedStorage(storage, ring) : storage;
}
