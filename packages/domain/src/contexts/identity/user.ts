import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import { UserId } from "../../value-objects/user-id.js";
import { Email } from "../../value-objects/email.js";
import type { Role, UserStatus } from "./role.js";

export interface UserProps {
  email: Email;
  name: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  lastLoginAt?: Date;
  assignedProjectIds: string[];
}

export class User extends Entity<UserId> {
  private constructor(
    id: UserId,
    readonly tenantId: TenantId,
    private props: UserProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: UserId;
    tenantId: TenantId;
    email: Email;
    name: string;
    passwordHash: string;
    role: Role;
    assignedProjectIds?: string[];
  }): User {
    if (!input.name || input.name.trim().length < 2) throw DomainError.validation("User name required");
    return new User(input.id, input.tenantId, {
      email: input.email,
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      role: input.role,
      status: "INVITED",
      assignedProjectIds: input.assignedProjectIds ?? [],
    });
  }

  static rehydrate(input: {
    id: UserId;
    tenantId: TenantId;
    props: UserProps;
    createdAt: Date;
  }): User {
    return new User(input.id, input.tenantId, input.props, input.createdAt);
  }

  get email(): Email { return this.props.email; }
  get name(): string { return this.props.name; }
  get role(): Role { return this.props.role; }
  get status(): UserStatus { return this.props.status; }
  get passwordHash(): string { return this.props.passwordHash; }
  get assignedProjectIds(): string[] { return [...this.props.assignedProjectIds]; }
  get lastLoginAt(): Date | undefined { return this.props.lastLoginAt; }

  activate(): void {
    if (this.props.status === "REMOVED") throw DomainError.invalidTransition("Cannot activate removed user");
    this.props.status = "ACTIVE";
    this.touch();
  }

  suspend(): void {
    if (this.props.status === "REMOVED") throw DomainError.invalidTransition("Cannot suspend removed user");
    this.props.status = "SUSPENDED";
    this.touch();
  }

  remove(): void {
    this.props.status = "REMOVED";
    this.touch();
  }

  changeRole(role: Role): void {
    if (this.props.status === "REMOVED") throw DomainError.invalidTransition("Cannot change role of removed user");
    this.props.role = role;
    this.touch();
  }

  assignProjects(ids: string[]): void {
    this.props.assignedProjectIds = Array.from(new Set(ids));
    this.touch();
  }

  setPasswordHash(hash: string): void {
    if (!hash) throw DomainError.validation("Password hash required");
    this.props.passwordHash = hash;
    this.touch();
  }

  recordLogin(): void {
    this.props.lastLoginAt = new Date();
    this.touch();
  }
}
