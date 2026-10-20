import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import { UserId } from "../../value-objects/user-id.js";
import { Email } from "../../value-objects/email.js";
import type { Role, UserStatus } from "./role.js";
import { MAX_FAILED_LOGINS, lockoutUntil } from "../../policies/login-lockout.js";

export interface UserProps {
  email: Email;
  name: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  lastLoginAt?: Date;
  assignedProjectIds: string[];
  passwordChangedAt?: Date | null;
  /** Wrong passwords since the last good sign-in. */
  failedLoginCount?: number;
  /** Sign-in is refused until this time. */
  lockedUntil?: Date | null;
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
  get passwordChangedAt(): Date | null { return this.props.passwordChangedAt ?? null; }
  get failedLoginCount(): number { return this.props.failedLoginCount ?? 0; }
  get lockedUntil(): Date | null { return this.props.lockedUntil ?? null; }

  /** The end of the lock if one is in force at `now`, else null. */
  lockedAt(now: Date): Date | null {
    const until = this.props.lockedUntil;
    return until && until.getTime() > now.getTime() ? until : null;
  }

  /** Counts a wrong password; the fifth in a row (since any lock ended) locks sign-in. Returns the lock end when it locked. */
  recordFailedLogin(now: Date): Date | null {
    const expired = this.props.lockedUntil && this.props.lockedUntil.getTime() <= now.getTime();
    const count = (expired ? 0 : this.props.failedLoginCount ?? 0) + 1;
    this.props.failedLoginCount = count;
    this.props.lockedUntil = count >= MAX_FAILED_LOGINS ? lockoutUntil(now) : null;
    this.touch();
    return this.props.lockedUntil ?? null;
  }

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

  /** The person's display name, as the directory holds it. */
  rename(name: string): void {
    if (!name || name.trim().length < 2) throw DomainError.validation("User name required");
    if (this.props.status === "REMOVED") throw DomainError.invalidTransition("Cannot rename removed user");
    this.props.name = name.trim();
    this.touch();
  }

  /** The address the person signs in with. */
  changeEmail(email: Email): void {
    if (this.props.status === "REMOVED") throw DomainError.invalidTransition("Cannot change the email of removed user");
    if (this.props.email.equals(email)) return;
    this.props.email = email;
    this.touch();
  }

  assignProjects(ids: string[]): void {
    this.props.assignedProjectIds = Array.from(new Set(ids));
    this.touch();
  }

  setPasswordHash(hash: string): void {
    if (!hash) throw DomainError.validation("Password hash required");
    this.props.passwordHash = hash;
    this.props.passwordChangedAt = new Date();
    this.props.failedLoginCount = 0;
    this.props.lockedUntil = null;
    this.touch();
  }

  recordLogin(): void {
    this.props.lastLoginAt = new Date();
    this.props.failedLoginCount = 0;
    this.props.lockedUntil = null;
    this.touch();
  }
}
