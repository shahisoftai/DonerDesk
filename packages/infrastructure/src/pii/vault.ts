import { createHmac, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

export type DataResidency = "EU" | "US" | "AFRICA" | "ASIA" | "DEFAULT";

export interface PiiVaultConfig {
  masterKey: string;
  kekDerivationSalt: string;
  residencyRegion: DataResidency;
}

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const HASH_DIGEST = "sha256";

export class PiiVault {
  private readonly masterKey: Buffer;
  private readonly derivationSalt: Buffer;
  private readonly residencyRegion: DataResidency;

  constructor(config: PiiVaultConfig) {
    this.masterKey = Buffer.from(config.masterKey, "hex");
    if (this.masterKey.length !== KEY_LENGTH) {
      throw new Error(`Master key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars)`);
    }
    this.derivationSalt = Buffer.from(config.kekDerivationSalt, "hex");
    if (this.derivationSalt.length < 16) {
      throw new Error("Key derivation salt must be at least 16 bytes (32 hex chars)");
    }
    this.residencyRegion = config.residencyRegion;
  }

  private deriveDek(residencyRegion: DataResidency, tenantId: string): Buffer {
    const context = `donordesk-pii:${residencyRegion}:${tenantId}`;
    return createHmac("sha256", this.masterKey)
      .update(this.derivationSalt)
      .update("\0")
      .update(context)
      .digest();
  }

  encrypt(plaintext: string, tenantId: string): { ciphertext: string; iv: string; authTag: string } {
    const dek = this.deriveDek(this.residencyRegion, tenantId);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, dek, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: encrypted.toString("base64url"),
      iv: iv.toString("base64url"),
      authTag: authTag.toString("base64url"),
    };
  }

  decrypt(ciphertext: string, iv: string, authTag: string, tenantId: string, residencyRegion?: DataResidency): string {
    const dek = this.deriveDek(residencyRegion ?? this.residencyRegion, tenantId);
    const decipher = createDecipheriv(
      ALGORITHM,
      dek,
      Buffer.from(iv, "base64url"),
      { authTagLength: AUTH_TAG_LENGTH },
    );
    decipher.setAuthTag(Buffer.from(authTag, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  hashForSearch(plaintext: string, tenantId: string): string {
    const dek = this.deriveDek(this.residencyRegion, tenantId);
    const normalized = plaintext.trim().toLowerCase();
    return createHmac(HASH_DIGEST, dek).update(normalized).digest("base64url");
  }

  hashEmail(email: string, tenantId: string): string {
    return this.hashForSearch(email, tenantId);
  }

  hashPhone(phone: string, tenantId: string): string {
    const digitsOnly = phone.replace(/\D/g, "");
    return this.hashForSearch(digitsOnly, tenantId);
  }

  hashNationalId(id: string, tenantId: string): string {
    return this.hashForSearch(id.replace(/\s/g, "").toUpperCase(), tenantId);
  }

  static generateKey(): string {
    return randomBytes(KEY_LENGTH).toString("hex");
  }

  static generateSalt(): string {
    return randomBytes(16).toString("hex");
  }
}

export class PiiSearchIndex {
  private readonly vault: PiiVault;
  private readonly tenantId: string;

  constructor(vault: PiiVault, tenantId: string) {
    this.vault = vault;
    this.tenantId = tenantId;
  }

  indexEmail(email: string): string {
    return this.vault.hashEmail(email, this.tenantId);
  }

  indexPhone(phone: string): string {
    return this.vault.hashPhone(phone, this.tenantId);
  }

  indexNationalId(id: string): string {
    return this.vault.hashNationalId(id, this.tenantId);
  }

  buildSearchHash(value: string): string {
    return this.vault.hashForSearch(value, this.tenantId);
  }
}
