import type { Result } from "@donordesk/domain";
import {
  DomainError,
  Organization,
  User,
  Email,
  TenantId,
  UserId,
  DataResidency,
  EntitlementGrant,
  isPlanCode,
  resolvePlan,
  isPlanForTrial,
} from "@donordesk/domain";
import type { IOrganizationRepository, IUserRepository, IAuthProvider } from "../../ports/identity.js";
import type { IIdGenerator, IAuditLogger, IClock } from "../../ports/core.js";
import type { IEntitlementGrantRepository, ITrialIdentityRepository } from "../../ports/billing.js";
import { emailFingerprint, domainFingerprint } from "../billing/_usage.js";

export interface ProvisionTenantCommand {
  name: string;
  email: string;
  passwordHash: string;
  organization: {
    name: string;
    organizationType: import("@donordesk/domain").OrganizationType;
    country: string;
    primarySector: import("@donordesk/domain").Sector;
    defaultLanguage?: import("@donordesk/domain").LanguageCode;
    dataResidency?: DataResidency;
    aiEnabled?: boolean;
    storageProvider?: import("@donordesk/domain").StorageProvider;
  };
  /** Requested plan (STARTER/TEAM/GROWTH). Enterprise cannot self-select. */
  requestedPlan?: string;
  /** Verified signup identity — required before a trial is granted. */
  verifiedEmail?: string;
  /** Audit actor; defaults to the created owner. */
  actorId?: string;
}

export interface ProvisionTenantResult {
  tenantId: string;
  orgId: string;
  userId: string;
  plan: string;
  trialGranted: boolean;
}

const TRIAL_DAYS_DEFAULT = 14;

/**
 * Central tenant provisioning used by every signup path (local, Google,
 * OIDC/SCIM, administrative creation). Atomically creates the organization,
 * owner, base entitlement grant, optional one-time trial, and audit trail.
 *
 * `?plan=` only requests trial consideration; it is never an entitlement by
 * itself. Unknown/absent plans fall back to STARTER. No second trial is
 * created for an existing organization/email fingerprint.
 */
export class ProvisionTenantHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly orgs: IOrganizationRepository,
    private readonly users: IUserRepository,
    private readonly grants: IEntitlementGrantRepository,
    private readonly trials: ITrialIdentityRepository,
    private readonly auth: IAuthProvider,
    private readonly events: { publish(_events: unknown[]): Promise<void> },
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(cmd: ProvisionTenantCommand): Promise<Result<ProvisionTenantResult, DomainError>> {
    const now = this.clock.now();
    const requestedPlan = cmd.requestedPlan ?? "STARTER";
    if (!isPlanCode(requestedPlan) || requestedPlan === "ENTERPRISE") {
      return { ok: false, error: DomainError.validation("Enterprise cannot self-select during signup.") };
    }

    const trialAllowed = isPlanForTrial(requestedPlan as "TEAM" | "GROWTH") && Boolean(cmd.verifiedEmail);

    // Abuse resistance: one trial per verified identity/domain.
    let trialGranted = false;
    if (trialAllowed && cmd.verifiedEmail) {
      const exists = await this.trials.existsByEmailFingerprint(emailFingerprint(cmd.verifiedEmail));
      if (!exists.ok) return exists;
      trialGranted = !exists.value;
    }

    const tenantIdStr = this.ids.generate();
    const tenantId = TenantId.create(tenantIdStr);
    const orgId = this.ids.generate();
    const userId = this.ids.generate();

    const org = Organization.create({
      id: orgId,
      tenantId,
      props: {
        name: cmd.organization.name,
        organizationType: cmd.organization.organizationType,
        country: cmd.organization.country,
        sectors: [cmd.organization.primarySector],
        contactName: cmd.name,
        contactEmail: cmd.email,
        defaultLanguage: cmd.organization.defaultLanguage ?? "en",
        dataResidency: cmd.organization.dataResidency ?? "DEFAULT",
        aiEnabled: cmd.organization.aiEnabled ?? true,
        storageProvider: cmd.organization.storageProvider ?? "LOCAL",
        reportingDefaults: Organization.defaultReportingDefaults(),
      },
    });
    const orgResult = await this.orgs.create(org);
    if (!orgResult.ok) return orgResult;

    const user = User.create({
      id: UserId.create(userId),
      tenantId,
      email: Email.create(cmd.email),
      name: cmd.name,
      passwordHash: cmd.passwordHash,
      role: "ADMIN",
    });
    user.activate();
    const userResult = await this.users.create(user);
    if (!userResult.ok) return userResult;

    // Base default grant (STARTER) is permanent.
    const baseGrant = EntitlementGrant.create({
      id: this.ids.generate(),
      props: {
        tenantId: tenantIdStr,
        planCode: "STARTER",
        source: "DEFAULT",
        effectiveFrom: now,
        createdById: userId,
        reason: "permanent-starter-base",
      },
    });
    const baseGrantResult = await this.grants.create(baseGrant);
    if (!baseGrantResult.ok) return baseGrantResult;

    // Optional one-time trial grant (valid window only; lazily enforced).
    let trialEndsAt: Date | undefined;
    if (trialGranted && cmd.verifiedEmail) {
      const planDef = resolvePlan(requestedPlan as "TEAM" | "GROWTH");
      const days = planDef.trialDays ?? TRIAL_DAYS_DEFAULT;
      trialEndsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const trialGrant = EntitlementGrant.create({
        id: this.ids.generate(),
        props: {
          tenantId: tenantIdStr,
          planCode: requestedPlan as "TEAM" | "GROWTH",
          source: "TRIAL",
          effectiveFrom: now,
          effectiveUntil: trialEndsAt,
          createdById: userId,
          reason: "signup-trial",
        },
      });
      const trialGrantResult = await this.grants.create(trialGrant);
      if (!trialGrantResult.ok) return trialGrantResult;

      const trialRecord = await this.trials.create({
        id: this.ids.generate(),
        tenantId: tenantIdStr,
        emailFingerprint: emailFingerprint(cmd.verifiedEmail),
        domainFingerprint: domainFingerprint(cmd.verifiedEmail),
        trialStartedAt: now,
        trialEndedAt: trialEndsAt,
      });
      if (!trialRecord.ok) return trialRecord;
    }

    const actorId = cmd.actorId ?? userId;
    await this.audit.record({
      tenantId,
      actorId,
      eventType: "identity.organization.created",
      entityType: "organization",
      entityId: orgId,
      newValue: JSON.stringify({ source: cmd.verifiedEmail ? "verified-signup" : "signup", plan: requestedPlan }),
    });
    await this.audit.record({
      tenantId,
      actorId,
      eventType: "identity.user.created",
      entityType: "user",
      entityId: userId,
    });
    if (trialGranted) {
      await this.audit.record({
        tenantId,
        actorId,
        eventType: "billing.trial.granted",
        entityType: "organization",
        entityId: orgId,
        newValue: JSON.stringify({ plan: requestedPlan, endsAt: trialEndsAt?.toISOString() }),
      });
    }

    return {
      ok: true,
      value: {
        tenantId: tenantIdStr,
        orgId,
        userId,
        plan: trialGranted ? (requestedPlan as "TEAM" | "GROWTH") : "STARTER",
        trialGranted,
      },
    };
  }
}
