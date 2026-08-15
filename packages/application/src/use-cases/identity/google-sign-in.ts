import { randomBytes } from "node:crypto";
import type { Result } from "@donordesk/domain";
import {
  DomainError,
  Email,
  TenantId,
  User,
  UserId,
} from "@donordesk/domain";
import type { IUserRepository, IOrganizationRepository, IAuthProvider } from "../../ports/identity.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { IGoogleSignInConnector } from "../../ports/infrastructure.js";
import { ProvisionTenantHandler } from "./provision-tenant.js";

export interface GoogleSignInCommand {
  code: string;
  /** Requested plan carried through signed OAuth state. */
  requestedPlan?: string;
}

export interface GoogleSignInResult {
  userId: string;
  tenantId: string;
  token: string;
  role: string;
  name: string;
  email: string;
  /** True when the account was just provisioned from Google (new user). */
  provisioned: boolean;
}

/**
 * Google Sign-In handler. Exchanges the OAuth code for a verified Google
 * profile and signs in the user whose email matches.
 *
 * - Existing accounts are signed in directly (mirrors LoginHandler, but uses
 *   Google's verified identity instead of a password).
 * - Unknown emails are auto-provisioned: a new tenant (organization) and an
 *   ACTIVE ADMIN user are created from the Google profile, so sign-up-with-
 *   Google works without a separate password. The response carries
 *   `provisioned: true` so the web can route the user into onboarding.
 */
export class GoogleSignInHandler {
  constructor(
    private readonly google: IGoogleSignInConnector,
    private readonly users: IUserRepository,
    private readonly orgs: IOrganizationRepository,
    private readonly auth: IAuthProvider,
    private readonly ids: IIdGenerator,
    private readonly audit: IAuditLogger,
    private readonly provisioner: ProvisionTenantHandler,
  ) {}

  async handle(cmd: GoogleSignInCommand): Promise<Result<GoogleSignInResult, DomainError>> {
    let profile;
    try {
      profile = await this.google.exchangeCode(cmd.code);
    } catch (error) {
      return { ok: false, error: DomainError.forbidden(error instanceof Error ? error.message : "Google Sign-In failed") };
    }

    let email: Email;
    try {
      email = Email.create(profile.email);
    } catch {
      return { ok: false, error: DomainError.validation("Google account email is invalid") };
    }

    const userResult = await this.users.findByEmailGlobal(email.toString());
    if (!userResult.ok) return userResult;

    if (userResult.value) {
      const user = userResult.value;
      if (user.status === "REMOVED") return { ok: false, error: DomainError.forbidden("Account removed") };
      if (user.status === "SUSPENDED") return { ok: false, error: DomainError.forbidden("Account suspended") };

      user.recordLogin();
      await this.users.update(user);

      await this.audit.record({
        tenantId: user.tenantId,
        actorId: user.id.toString(),
        eventType: "identity.user.login",
        entityType: "user",
        entityId: user.id.toString(),
        newValue: "google",
      });

      const token = await this.auth.sign(
        {
          sub: user.id.toString(),
          tid: user.tenantId.toString(),
          role: user.role,
          name: user.name,
          email: user.email.toString(),
        },
        60 * 60 * 24 * 7,
      );

      return {
        ok: true,
        value: {
          userId: user.id.toString(),
          tenantId: user.tenantId.toString(),
          token,
          role: user.role,
          name: user.name,
          email: user.email.toString(),
          provisioned: false,
        },
      };
    }

    return this.provision(email, profile, cmd.requestedPlan);
  }

  private async provision(
    email: Email,
    profile: { email: string; name: string; googleSubject: string },
    requestedPlan?: string,
  ): Promise<Result<GoogleSignInResult, DomainError>> {
    const displayName = (profile.name && profile.name.trim().length > 0 ? profile.name.trim() : email.toString());
    const passwordHash = randomBytes(32).toString("hex");

    const provisioned = await this.provisioner.handle({
      name: displayName,
      email: email.toString(),
      passwordHash,
      verifiedEmail: email.toString(),
      requestedPlan,
      organization: {
        name: `${displayName}'s Organization`,
        organizationType: "OTHER",
        country: "UNKNOWN",
        primarySector: "OTHER",
        defaultLanguage: "en",
        dataResidency: "DEFAULT",
        aiEnabled: true,
        storageProvider: "LOCAL",
      },
    });
    if (!provisioned.ok) return provisioned;

    const value = provisioned.value;
    await this.audit.record({
      tenantId: TenantId.create(value.tenantId),
      actorId: value.userId,
      eventType: "identity.user.login",
      entityType: "user",
      entityId: value.userId,
      newValue: "google",
    });

    const token = await this.auth.sign(
      {
        sub: value.userId,
        tid: value.tenantId,
        role: "ADMIN",
        name: displayName,
        email: email.toString(),
      },
      60 * 60 * 24 * 7,
    );

    return {
      ok: true,
      value: {
        userId: value.userId,
        tenantId: value.tenantId,
        token,
        role: "ADMIN",
        name: displayName,
        email: email.toString(),
        provisioned: true,
      },
    };
  }
}
