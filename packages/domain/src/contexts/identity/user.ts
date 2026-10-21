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
  /** An outside implementing partner (limited access; see the external-access rules in the api). */
  external?: boolean;
  /** The sealed TOTP secret once multi-factor sign-in is on. */
  mfaSecretEnc?: string | null;
  /** A secret shown to the person but not yet proven with a code. */
  mfaPendingSecretEnc?: string | null;
  mfaEnabledAt?: Date | null;
  /** Hashes of the unused one-time recovery codes. */
  mfaRecoveryHashes?: string[];
  /** The last accepted time step, so a code cannot be used twice. */
  mfaLastStep?: number | null;
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
    external?: boolean;
  }): User {
    if (!input.name || input.name.trim().length < 2) throw DomainError.validation("User name required");
    return new User(input.id, input.tenantId, {
      email: input.email,
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      role: input.role,
      status: "INVITED",
      assignedProjectIds: input.assignedProjectIds ?? [],
      external: input.external === true,
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
  get external(): boolean { return this.props.external === true; }
  get mfaEnabled(): boolean { return Boolean(this.props.mfaSecretEnc && this.props.mfaEnabledAt); }
  get mfaSecretEnc(): string | null { return this.props.mfaSecretEnc ?? null; }
  get mfaPendingSecretEnc(): string | null { return this.props.mfaPendingSecretEnc ?? null; }
  get mfaEnabledAt(): Date | null { return this.props.mfaEnabledAt ?? null; }
  get mfaRecoveryHashes(): string[] { return [...(this.props.mfaRecoveryHashes ?? [])]; }
  get mfaLastStep(): number | null { return this.props.mfaLastStep ?? null; }

  /** Starts (or restarts) enrolment: the secret is kept sealed until a code proves the person's app has it. */
  beginMfaEnrollment(pendingSecretEnc: string): void {
    if (this.mfaEnabled) throw DomainError.conflict("Two-step sign-in is already on. Turn it off first to set it up again.");
    this.props.mfaPendingSecretEnc = pendingSecretEnc;
    this.touch();
  }

  /** The code proved it: the pending secret becomes the secret, with a fresh set of recovery codes. */
  enableMfa(now: Date, recoveryHashes: string[], step: number): void {
    if (!this.props.mfaPendingSecretEnc) throw DomainError.validation("Start the setup first.");
    this.props.mfaSecretEnc = this.props.mfaPendingSecretEnc;
    this.props.mfaPendingSecretEnc = null;
    this.props.mfaEnabledAt = now;
    this.props.mfaRecoveryHashes = [...recoveryHashes];
    this.props.mfaLastStep = step;
    this.touch();
  }

  disableMfa(): void {
    this.props.mfaSecretEnc = null;
    this.props.mfaPendingSecretEnc = null;
    this.props.mfaEnabledAt = null;
    this.props.mfaRecoveryHashes = [];
    this.props.mfaLastStep = null;
    this.touch();
  }

  /** Accepts a time step only if it is newer than the last one used: the same code cannot sign in twice. */
  acceptMfaStep(step: number): boolean {
    if (this.props.mfaLastStep !== null && this.props.mfaLastStep !== undefined && step <= this.props.mfaLastStep) return false;
    this.props.mfaLastStep = step;
    this.touch();
    return true;
  }

  /** A recovery code works once: it is removed when used. */
  useRecoveryCode(hash: string): boolean {
    const hashes = this.props.mfaRecoveryHashes ?? [];
    if (!hashes.includes(hash)) return false;
    this.props.mfaRecoveryHashes = hashes.filter((h) => h !== hash);
    this.touch();
    return true;
  }

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
