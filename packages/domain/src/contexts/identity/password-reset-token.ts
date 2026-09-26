import { randomBytes, createHash } from "node:crypto";
import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { TenantId } from "../../value-objects/tenant-id.js";

export interface PasswordResetTokenProps {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class PasswordResetToken extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantId: TenantId,
    private props: PasswordResetTokenProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: TenantId;
    userId: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): { token: PasswordResetToken; plaintextToken: string } {
    if (!input.userId) throw DomainError.validation("PasswordResetToken requires a userId");
    const plaintextToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(plaintextToken);
    const entity = new PasswordResetToken(
      input.id,
      input.tenantId,
      {
        userId: input.userId,
        tokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
      new Date(),
    );
    return { token: entity, plaintextToken };
  }

  static rehydrate(input: {
    id: string;
    tenantId: TenantId;
    props: PasswordResetTokenProps;
    createdAt: Date;
  }): PasswordResetToken {
    return new PasswordResetToken(input.id, input.tenantId, input.props, input.createdAt);
  }

  get userId(): string { return this.props.userId; }
  get tokenHash(): string { return this.props.tokenHash; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get usedAt(): Date | null { return this.props.usedAt ?? null; }
  get ipAddress(): string | null { return this.props.ipAddress ?? null; }
  get userAgent(): string | null { return this.props.userAgent ?? null; }

  isExpired(now: Date = new Date()): boolean {
    return this.props.expiresAt.getTime() <= now.getTime();
  }

  isUsed(): boolean {
    return this.props.usedAt != null;
  }

  consume(now: Date = new Date()): void {
    if (this.props.usedAt) throw DomainError.invariant("PasswordResetToken already used", { tokenId: this.id });
    if (this.isExpired(now)) throw DomainError.invariant("PasswordResetToken expired", { tokenId: this.id });
    this.props.usedAt = now;
    this.touch();
  }

  static hash(plaintextToken: string): string {
    return hashToken(plaintextToken);
  }
}

export function hashToken(plaintextToken: string): string {
  return createHash("sha256").update(plaintextToken).digest("hex");
}
