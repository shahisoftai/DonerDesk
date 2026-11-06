import { randomBytes, createHash } from "node:crypto";
import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { TenantId } from "../../value-objects/tenant-id.js";

export interface ScimCredentialProps {
  tenantId: string;
  name: string;
  /// SHA-256 of the bearer token. The token itself is shown once and never stored.
  tokenHash: string;
  createdById: string;
  lastUsedAt?: Date | null;
  revokedAt?: Date | null;
}

/**
 * A credential an identity provider uses to provision this organisation's
 * users over SCIM. Only the hash is kept: the token is shown once, at issue
 * time, and the provider is the only other holder of it.
 */
export class ScimCredential extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantId: TenantId,
    private props: ScimCredentialProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: { id: string; tenantId: TenantId; name: string; createdById: string }): {
    credential: ScimCredential;
    plaintextToken: string;
  } {
    if (!input.name || input.name.trim().length < 2) throw DomainError.validation("Give the credential a name");
    if (!input.createdById) throw DomainError.validation("ScimCredential requires a createdById");
    const plaintextToken = randomBytes(32).toString("base64url");
    const credential = new ScimCredential(
      input.id,
      input.tenantId,
      {
        tenantId: input.tenantId.toString(),
        name: input.name.trim(),
        tokenHash: hashScimToken(plaintextToken),
        createdById: input.createdById,
        lastUsedAt: null,
        revokedAt: null,
      },
      new Date(),
    );
    return { credential, plaintextToken };
  }

  static rehydrate(input: {
    id: string;
    tenantId: TenantId;
    props: ScimCredentialProps;
    createdAt: Date;
  }): ScimCredential {
    return new ScimCredential(input.id, input.tenantId, input.props, input.createdAt);
  }

  get name(): string { return this.props.name; }
  get tokenHash(): string { return this.props.tokenHash; }
  get createdById(): string { return this.props.createdById; }
  get lastUsedAt(): Date | null { return this.props.lastUsedAt ?? null; }
  get revokedAt(): Date | null { return this.props.revokedAt ?? null; }

  isRevoked(): boolean {
    return this.props.revokedAt != null;
  }

  /** A revoked credential no longer authenticates. */
  isUsable(now: Date = new Date()): boolean {
    return !this.isRevoked();
  }

  markUsed(now: Date = new Date()): void {
    this.props.lastUsedAt = now;
    this.touch();
  }

  revoke(now: Date = new Date()): void {
    if (this.props.revokedAt) return;
    this.props.revokedAt = now;
    this.touch();
  }
}

export function hashScimToken(plaintextToken: string): string {
  return createHash("sha256").update(plaintextToken).digest("hex");
}
