import bcrypt from "bcryptjs";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ALL_ROLES, TenantId, type Role } from "@donordesk/domain";
import type { AuthenticatedUser, IAuthProvider } from "@donordesk/application";

export class OidcAuthProvider implements IAuthProvider {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor() {
    this.issuer = required("OIDC_ISSUER").replace(/\/$/, "");
    this.audience = required("OIDC_AUDIENCE");
    this.jwks = createRemoteJWKSet(new URL(process.env.OIDC_JWKS_URI ?? `${this.issuer}/protocol/openid-connect/certs`));
  }

  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async sign(): Promise<string> {
    throw new Error("Tokens are issued by the configured OIDC provider");
  }

  async verify(token: string): Promise<AuthenticatedUser | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer, audience: this.audience });
      const role = normalizeRole(payload.roles ?? payload.role ?? payload.realm_access);
      const tenantId = typeof payload.org_id === "string" ? payload.org_id : undefined;
      if (!payload.sub || !tenantId || !role) return null;
      return {
        userId: payload.sub,
        tenantId: TenantId.create(tenantId),
        role,
        email: typeof payload.email === "string" ? payload.email : "",
        name: typeof payload.name === "string" ? payload.name : "",
      };
    } catch {
      return null;
    }
  }
}

function normalizeRole(value: unknown): Role | undefined {
  const values = Array.isArray(value)
    ? value
    : value && typeof value === "object" && "roles" in value && Array.isArray(value.roles)
      ? value.roles
      : [value];
  return values.find((candidate): candidate is Role => typeof candidate === "string" && ALL_ROLES.includes(candidate as Role));
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when AUTH_PROVIDER=oidc`);
  return value;
}
