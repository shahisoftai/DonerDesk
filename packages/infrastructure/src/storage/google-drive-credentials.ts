import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { DomainError, type Result } from "@donordesk/domain";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function err(e: Error): Result<never, DomainError> {
  return { ok: false, error: new DomainError("CONFLICT", e.message) };
}

/**
 * Persists each tenant's Google Drive OAuth refresh token as an encrypted
 * TENANT-scoped CONNECTOR configuration (provider `google-drive-oauth`) in the
 * PlatformConfiguration table. Secrets are AES-256-GCM encrypted with the
 * PLATFORM_MASTER_KEY, mirroring the SuperAdmin control-plane pattern.
 */
export class PrismaGoogleDriveCredentialStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly masterKey: Buffer,
  ) {}

  async save(tenantId: string, refreshToken: string): Promise<Result<void, DomainError>> {
    this.requireMasterKey();
    const encrypted = this.encrypt(refreshToken);
    try {
      const provider = "google-drive-oauth";
      const existing = await this.prisma.platformConfiguration.findUnique({
        where: { scopeType_scopeId_category_provider: { scopeType: "TENANT", scopeId: tenantId, category: "CONNECTOR", provider } },
      });
      if (existing) {
        await this.prisma.platformConfiguration.update({
          where: { id: existing.id },
          data: {
            enabled: true,
            secretCiphertext: encrypted.ciphertext,
            secretIv: encrypted.iv,
            secretTag: encrypted.tag,
            secretVersion: existing.secretVersion + 1,
            updatedAt: new Date(),
          },
        });
      } else {
        await this.prisma.platformConfiguration.create({
          data: {
            id: randomBytes(16).toString("hex"),
            scopeType: "TENANT",
            scopeId: tenantId,
            category: "CONNECTOR",
            provider,
            displayName: "Google Drive (tenant)",
            enabled: true,
            configurationJson: "{}",
            secretCiphertext: encrypted.ciphertext,
            secretIv: encrypted.iv,
            secretTag: encrypted.tag,
            createdById: "system:onboarding",
            updatedById: "system:onboarding",
          },
        });
      }
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error("Could not persist Google Drive credentials"));
    }
  }

  async find(tenantId: string): Promise<Result<{ refreshToken: string } | null, DomainError>> {
    this.requireMasterKey();
    try {
      const row = await this.prisma.platformConfiguration.findUnique({
        where: { scopeType_scopeId_category_provider: { scopeType: "TENANT", scopeId: tenantId, category: "CONNECTOR", provider: "google-drive-oauth" } },
      });
      if (!row || !row.secretCiphertext || !row.secretIv || !row.secretTag) return ok(null);
      const refreshToken = this.decrypt(row.secretCiphertext, row.secretIv, row.secretTag);
      return ok({ refreshToken });
    } catch (e) {
      return err(e instanceof Error ? e : new Error("Could not read Google Drive credentials"));
    }
  }

  private requireMasterKey(): void {
    if (this.masterKey.length !== 32) throw new Error("PLATFORM_MASTER_KEY must be a Base64-encoded 32-byte key");
  }

  private encrypt(value: string): { ciphertext: string; iv: string; tag: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return {
      ciphertext: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    };
  }

  private decrypt(ciphertext: string, iv: string, tag: string): string {
    const decipher = createDecipheriv("aes-256-gcm", this.masterKey, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
  }
}
