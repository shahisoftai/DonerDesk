import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import { Email } from "../../value-objects/email.js";
import type { Role } from "./role.js";

export interface InvitationProps {
  email: Email;
  role: Role;
  invitedById: string;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  projectIds: string[];
}

export class Invitation extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantId: TenantId,
    private props: InvitationProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: TenantId;
    email: Email;
    role: Role;
    invitedById: string;
    token: string;
    projectIds?: string[];
    ttlDays?: number;
  }): Invitation {
    const ttl = input.ttlDays ?? 7;
    return new Invitation(input.id, input.tenantId, {
      email: input.email,
      role: input.role,
      invitedById: input.invitedById,
      token: input.token,
      expiresAt: new Date(Date.now() + ttl * 24 * 60 * 60 * 1000),
      projectIds: input.projectIds ?? [],
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: TenantId;
    props: InvitationProps;
    createdAt: Date;
  }): Invitation {
    return new Invitation(input.id, input.tenantId, input.props, input.createdAt);
  }

  get email(): Email { return this.props.email; }
  get role(): Role { return this.props.role; }
  get invitedById(): string { return this.props.invitedById; }
  get token(): string { return this.props.token; }
  get expiresAt(): Date { return new Date(this.props.expiresAt.getTime()); }
  get acceptedAt(): Date | undefined { return this.props.acceptedAt; }
  get projectIds(): string[] { return [...this.props.projectIds]; }

  isExpired(): boolean {
    return this.props.expiresAt.getTime() < Date.now();
  }

  isAccepted(): boolean {
    return this.props.acceptedAt !== undefined;
  }

  accept(): void {
    if (this.isExpired()) throw DomainError.invalidTransition("Invitation expired");
    if (this.isAccepted()) throw DomainError.invalidTransition("Invitation already accepted");
    this.props.acceptedAt = new Date();
    this.touch();
  }
}
