import { randomBytes } from "node:crypto";
import type { Result } from "@donordesk/domain";
import {
  DomainError,
  Email,
  Organization,
  TenantId,
  User,
  UserId,
} from "@donordesk/domain";
import type { IUserRepository, IOrganizationRepository, IAuthProvider } from "../../ports/identity.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { IGoogleSignInConnector } from "../../ports/infrastructure.js";

export interface GoogleSignInCommand {
  code: string;
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

    return this.provision(email, profile);
  }

  private async provision(
    email: Email,
    profile: { email: string; name: string; googleSubject: string },
  ): Promise<Result<GoogleSignInResult, DomainError>> {
    const tenantIdStr = this.ids.generate();
    const tenantId = TenantId.create(tenantIdStr);
    const orgId = this.ids.generate();
    const userId = this.ids.generate();
    const displayName = (profile.name && profile.name.trim().length > 0 ? profile.name.trim() : email.toString());

    const org = Organization.create({
      id: orgId,
      tenantId,
      props: {
        name: `${displayName}'s Organization`,
        organizationType: "OTHER",
        country: "UNKNOWN",
        sectors: ["OTHER"],
        contactName: displayName,
        contactEmail: email.toString(),
        defaultLanguage: "en",
        dataResidency: "DEFAULT",
        aiEnabled: true,
        storageProvider: "LOCAL",
      },
    });
    const orgResult = await this.orgs.create(org);
    if (!orgResult.ok) return orgResult;

    // No password for Google-provisioned users; store an unusable random hash
    // so the field is never empty and password login cannot be used.
    const passwordHash = randomBytes(32).toString("hex");
    const user = User.create({
      id: UserId.create(userId),
      tenantId,
      email,
      name: displayName,
      passwordHash,
      role: "ADMIN",
    });
    user.activate();
    const userResult = await this.users.create(user);
    if (!userResult.ok) return userResult;

    await this.audit.record({
      tenantId,
      actorId: userId,
      eventType: "identity.organization.created",
      entityType: "organization",
      entityId: orgId,
      newValue: "google-provisioned",
    });
    await this.audit.record({
      tenantId,
      actorId: userId,
      eventType: "identity.user.created",
      entityType: "user",
      entityId: userId,
      newValue: "google-provisioned",
    });
    await this.audit.record({
      tenantId,
      actorId: userId,
      eventType: "identity.user.login",
      entityType: "user",
      entityId: userId,
      newValue: "google",
    });

    const token = await this.auth.sign(
      {
        sub: userId,
        tid: tenantIdStr,
        role: "ADMIN",
        name: displayName,
        email: email.toString(),
      },
      60 * 60 * 24 * 7,
    );

    return {
      ok: true,
      value: {
        userId,
        tenantId: tenantIdStr,
        token,
        role: "ADMIN",
        name: displayName,
        email: email.toString(),
        provisioned: true,
      },
    };
  }
}
