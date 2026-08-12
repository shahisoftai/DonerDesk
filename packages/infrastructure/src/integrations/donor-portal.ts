import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface SignedUrlParams {
  tenantId: string;
  resourceType: "report" | "evidence" | "export";
  resourceId: string;
  recipientEmail?: string;
  expiresAt: Date;
  permissions?: ("view" | "download")[];
}

export interface SignedUrl {
  url: string;
  token: string;
  expiresAt: Date;
}

export interface DonorPortalConfig {
  baseUrl: string;
  signingSecret: string;
  defaultExpiryHours?: number;
}

export class DonorPortalService {
  private readonly baseUrl: string;
  private readonly signingSecret: Buffer;
  private readonly defaultExpiry: number;
  private readonly maxExpiry = 7 * 24 * 60 * 60 * 1000;

  constructor(config: DonorPortalConfig) {
    const baseUrl = new URL(config.baseUrl);
    if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password) {
      throw new Error("Donor portal base URL must use HTTPS without embedded credentials");
    }
    this.baseUrl = baseUrl.toString().replace(/\/$/, "");
    this.signingSecret = Buffer.from(config.signingSecret, "hex");
    if (this.signingSecret.length !== 32) {
      throw new Error("Signing secret must be 32 bytes (64 hex chars)");
    }
    const defaultExpiryHours = config.defaultExpiryHours ?? 72;
    if (!Number.isFinite(defaultExpiryHours) || defaultExpiryHours <= 0 || defaultExpiryHours > 168) {
      throw new Error("Default expiry must be between 0 and 168 hours");
    }
    this.defaultExpiry = defaultExpiryHours * 60 * 60 * 1000;
  }

  generateSignedUrl(params: Partial<SignedUrlParams> & {
    resourceType: "report" | "evidence" | "export";
    resourceId: string;
  }): SignedUrl {
    const expiresAt = params.expiresAt ?? new Date(Date.now() + this.defaultExpiry);
    const permissions = params.permissions ?? ["view", "download"];
    const expiresIn = expiresAt.getTime() - Date.now();
    if (!params.tenantId?.trim() || !params.resourceId.trim()) {
      throw new Error("Tenant and resource identifiers are required");
    }
    if (!Number.isFinite(expiresAt.getTime()) || expiresIn <= 0 || expiresIn > this.maxExpiry) {
      throw new Error("Signed URL expiry must be in the future and no more than 7 days away");
    }
    if (permissions.length === 0 || permissions.some((permission) => permission !== "view" && permission !== "download")) {
      throw new Error("At least one valid permission is required");
    }

    const payload = {
      v: 1,
      tenant: params.tenantId,
      type: params.resourceType,
      id: params.resourceId,
      email: params.recipientEmail ?? "",
      perms: permissions.join(","),
      exp: Math.floor(expiresAt.getTime() / 1000),
      nonce: randomBytes(8).toString("hex"),
    };

    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const payloadAndSig = `${encoded}.${this.computeSignature(encoded)}`;

    const url = `${this.baseUrl}/portal/access/${payloadAndSig}`;

    return {
      url,
      token: payloadAndSig,
      expiresAt,
    };
  }

  verifySignedUrl(token: string, expectedTenantId?: string): {
    valid: boolean;
    params?: SignedUrlParams;
    error?: string;
  } {
    const parts = token.split(".");
    if (token.length > 4096 || parts.length !== 2) {
      return { valid: false, error: "Invalid token format" };
    }

    const encoded = parts[0] ?? "";
    const providedSig = parts[1] ?? "";
    const expectedSig = this.computeSignature(encoded);

    if (!/^[a-fA-F0-9]{64}$/.test(providedSig)) {
      return { valid: false, error: "Invalid signature" };
    }
    const expectedBuffer = Buffer.from(expectedSig, "hex");
    const providedBuffer = Buffer.from(providedSig, "hex");
    if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
      return { valid: false, error: "Invalid signature" };
    }

    try {
      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
        v: unknown;
        tenant: unknown;
        type: string;
        id: string;
        email: string;
        perms: string;
        exp: number;
      };

      const validTypes = ["report", "evidence", "export"];
      const permissions = typeof payload.perms === "string" ? payload.perms.split(",") : [];
      if (payload.v !== 1 || typeof payload.tenant !== "string" || !payload.tenant
        || typeof payload.id !== "string" || !payload.id || !validTypes.includes(payload.type)
        || typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp)
        || permissions.length === 0
        || permissions.some((permission) => permission !== "view" && permission !== "download")) {
        return { valid: false, error: "Invalid token payload" };
      }
      if (expectedTenantId && payload.tenant !== expectedTenantId) {
        return { valid: false, error: "Token tenant mismatch" };
      }

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now || payload.exp - now > this.maxExpiry / 1000) {
        return { valid: false, error: "Token expired" };
      }

      return {
        valid: true,
        params: {
          tenantId: payload.tenant,
          resourceType: payload.type as SignedUrlParams["resourceType"],
          resourceId: payload.id,
          recipientEmail: payload.email || undefined,
          expiresAt: new Date(payload.exp * 1000),
          permissions: permissions as ("view" | "download")[],
        },
      };
    } catch {
      return { valid: false, error: "Invalid token encoding" };
    }
  }

  generatePortalLink(
    tenantId: string,
    reportId: string,
    recipientEmail: string,
    expiresInHours?: number,
  ): SignedUrl {
    return this.generateSignedUrl({
      tenantId,
      resourceType: "report",
      resourceId: reportId,
      recipientEmail,
      expiresAt: expiresInHours
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        : undefined,
      permissions: ["view"],
    });
  }

  generateEvidenceAccessLink(
    tenantId: string,
    evidenceId: string,
    recipientEmail: string,
    expiresInHours?: number,
  ): SignedUrl {
    return this.generateSignedUrl({
      tenantId,
      resourceType: "evidence",
      resourceId: evidenceId,
      recipientEmail,
      expiresAt: expiresInHours
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        : undefined,
      permissions: ["view", "download"],
    });
  }

  private computeSignature(payload: string): string {
    return createHmac("sha256", this.signingSecret).update(payload).digest("hex");
  }
}

export function createDonorPortalService(config: DonorPortalConfig): DonorPortalService {
  return new DonorPortalService(config);
}
