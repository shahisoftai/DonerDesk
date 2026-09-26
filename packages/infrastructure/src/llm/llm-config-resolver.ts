import type { PrismaClient } from "@prisma/client";
import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { LLMProviderConfig } from "./factory.js";
import { SecretCipher } from "../security/secret-cipher.js";

type PlatformConfigurationRow = {
  id: string;
  scopeType: string;
  scopeId: string | null;
  category: string;
  provider: string;
  displayName: string;
  enabled: boolean;
  configurationJson: string;
  secretCiphertext: string | null;
  secretIv: string | null;
  secretTag: string | null;
  secretVersion: number;
  updatedAt: Date | string;
};

export interface PlatformLlmConfigInput {
  tenantId?: string;
}

/** Providers a PlatformConfiguration LLM row may select. */
export const PLATFORM_LLM_PROVIDERS = ["openai", "anthropic", "gemini", "deepseek", "minimax", "ollama"] as const;

export interface ResolvedLlmConfig extends LLMProviderConfig {
  /** TENANT = the tenant's own API configuration; GLOBAL = the platform default. */
  scope: "TENANT" | "GLOBAL";
  configId: string;
  /** Changes whenever the row is edited or its secret rotated (cache key). */
  fingerprint: string;
}

export class PlatformLlmConfigResolver {
  private readonly cipher: SecretCipher;

  constructor(
    private readonly prisma: PrismaClient,
    masterKey: Buffer,
  ) {
    this.cipher = new SecretCipher(masterKey);
  }

  /**
   * The LLM every report generation for `tenantId` must use: the tenant's own
   * enabled configuration when present, otherwise the enabled GLOBAL (platform
   * default) configuration. The control plane keeps at most one enabled row
   * per scope, so the choice is deterministic.
   */
  async resolve(input?: PlatformLlmConfigInput): Promise<Result<ResolvedLlmConfig | null, DomainError>> {
    const rows = await this.prisma.$queryRawUnsafe<PlatformConfigurationRow[]>(
      `SELECT * FROM "PlatformConfiguration"
       WHERE "category" = 'LLM'
         AND "enabled" = true
       ORDER BY
         CASE WHEN "scopeType" = 'TENANT' AND "scopeId" = $1 THEN 0
              WHEN "scopeType" = 'GLOBAL' THEN 1
              ELSE 2
         END,
         "updatedAt" DESC
       LIMIT 1`,
      input?.tenantId ?? null,
    );

    if (!rows || rows.length === 0) {
      return { ok: true, value: null };
    }

    const row = rows[0]!;

    let apiKey: string | undefined;
    if (row.secretCiphertext && row.secretIv && row.secretTag) {
      try {
        const decrypted = this.cipher.decrypt({
          ciphertext: row.secretCiphertext,
          iv: row.secretIv,
          tag: row.secretTag,
        });
        const secrets = JSON.parse(decrypted) as Record<string, string>;
        apiKey = secrets.apiKey;
      } catch {
        return {
          ok: false,
          error: DomainError.invariant("Failed to decrypt LLM provider secrets"),
        };
      }
    }

    const config = JSON.parse(String(row.configurationJson || "{}")) as Record<string, unknown>;

    const provider = row.provider as LLMProviderConfig["provider"];
    if (!(PLATFORM_LLM_PROVIDERS as readonly string[]).includes(provider)) {
      return { ok: true, value: null };
    }

    // Defensively reject malformed base URLs (e.g. "https://minimax.io-v1")
    // so a bad stored value falls back to the provider's default instead of
    // silently failing every LLM call.
    let baseUrl = typeof config.baseUrl === "string" && config.baseUrl.trim() ? config.baseUrl.trim() : undefined;
    if (baseUrl) {
      try {
        const parsed = new URL(baseUrl);
        const host = parsed.hostname;
        const lastLabel = host.split(".").pop() ?? "";
        const validTld = /^[a-z]{2,}$/i.test(lastLabel);
        if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || host.length < 3 || !validTld) {
          throw new Error("unsupported protocol or malformed host");
        }
      } catch {
        baseUrl = undefined;
      }
    }

    return {
      ok: true,
      value: {
        provider,
        model: typeof config.model === "string" && config.model.trim() ? config.model.trim() : undefined,
        baseUrl,
        timeoutMs: typeof config.timeoutMs === "number" ? config.timeoutMs : undefined,
        groupId: typeof config.groupId === "string" ? config.groupId : undefined,
        effort: typeof config.effort === "string" && config.effort.trim() ? config.effort.trim() : undefined,
        apiKey,
        scope: row.scopeType === "TENANT" ? "TENANT" : "GLOBAL",
        configId: row.id,
        fingerprint: `${row.id}:${new Date(row.updatedAt).getTime()}:${row.secretVersion}`,
      },
    };
  }
}
