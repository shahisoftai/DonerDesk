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
  isPlanForTrial,
  PLAN_CATALOG,
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
  /** Start a local 14-day trial of `requestedPlan` instead of the free STARTER base (TEAM/GROWTH only). */
  startTrial?: boolean;
  /** Verified signup identity; recorded for audit. */
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

/**
 * Central tenant provisioning used by every signup path (local, Google,
 * OIDC/SCIM, administrative creation). Atomically creates the organization,
 * owner, the permanent free STARTER grant, and the audit trail.
 *
 * Every new workspace starts on the free STARTER tier; paid tiers (TEAM/GROWTH)
 * are unlocked by a paid Creem subscription after signup. `?plan=` is only an
 * intent hint for the checkout flow and never an entitlement by itself.
 */
export class ProvisionTenantHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly orgs: IOrganizationRepository,
    private readonly users: IUserRepository,
    private readonly grants: IEntitlementGrantRepository,
    private readonly auth: IAuthProvider,
    private readonly events: { publish(_events: unknown[]): Promise<void> },
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly trialIdentities?: ITrialIdentityRepository,
    /**
     * Server-side kill switch for local trials (defaults off — the marketing
     * surface is separately gated by NEXT_PUBLIC_TRIALS_ENABLED; this closes
     * the crafted-request bypass where a client flag alone controlled trials).
     * Ops enables with TRIALS_ENABLED=1 in the api environment. Deliberately
     * does NOT fall back to NEXT_PUBLIC_TRIALS_ENABLED — that var is read by
     * the web app only, and falling back to it here would let ops turn on
     * real trials by setting the public marketing flag alone, reopening the
     * exact bypass this switch exists to close.
     */
    private readonly trialsEnabled: boolean = process.env.TRIALS_ENABLED === "1",
  ) {}

  async handle(cmd: ProvisionTenantCommand): Promise<Result<ProvisionTenantResult, DomainError>> {
    const now = this.clock.now();
    const requestedPlan = cmd.requestedPlan ?? "STARTER";
    if (!isPlanCode(requestedPlan) || requestedPlan === "ENTERPRISE") {
      return { ok: false, error: DomainError.validation("Enterprise cannot self-select during signup.") };
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
        // Agent Memory (Phase 21) is off by default for every new tenant;
        // self-service opt-in via Settings once the platform flag is on.
        agentMemoryEnabled: false,
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

    // Base default grant (STARTER) is permanent and free.
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

    // Local trial (TRIAL source sits between CREEM_SUBSCRIPTION and DEFAULT in
    // precedence — see calculateEntitlement — so a later paid subscription
    // supersedes it, and expiry falls back to the permanent STARTER grant
    // above without losing data). One trial per TrialIdentity fingerprint;
    // a SuperAdmin can override (WS-K).
    let trialGranted = false;
    let trialFingerprintBlocked = false;
    let trialDisabledByFlag = false;
    if (cmd.startTrial && this.trialIdentities && isPlanForTrial(requestedPlan)) {
      if (!this.trialsEnabled) {
        // Server-side kill switch: honor the request shape but grant nothing,
        // and record why so ops can see flag-gated trial attempts in audit.
        trialDisabledByFlag = true;
      } else {
        const emailFp = emailFingerprint(cmd.email);
        const alreadyUsed = await this.trialIdentities.existsByEmailFingerprint(emailFp);
        if (!alreadyUsed.ok) return alreadyUsed;
        if (!alreadyUsed.value) {
          const trialDays = PLAN_CATALOG[requestedPlan].trialDays;
          if (trialDays !== null) {
            const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
            const trialGrant = EntitlementGrant.create({
              id: this.ids.generate(),
              props: {
                tenantId: tenantIdStr,
                planCode: requestedPlan,
                source: "TRIAL",
                effectiveFrom: now,
                effectiveUntil: trialEnd,
                createdById: userId,
                reason: "signup-trial",
              },
            });
            const trialGrantResult = await this.grants.create(trialGrant);
            if (!trialGrantResult.ok) return trialGrantResult;
            const identityResult = await this.trialIdentities.create({
              id: this.ids.generate(),
              tenantId: tenantIdStr,
              emailFingerprint: emailFp,
              domainFingerprint: domainFingerprint(cmd.email),
              trialStartedAt: now,
              trialEndedAt: trialEnd,
            });
            if (!identityResult.ok) return identityResult;
            trialGranted = true;
          }
        } else {
          trialFingerprintBlocked = true;
        }
      }
    }

    const actorId = cmd.actorId ?? userId;
    await this.audit.record({
      tenantId,
      actorId,
      eventType: "identity.organization.created",
      entityType: "organization",
      entityId: orgId,
      newValue: JSON.stringify({ source: cmd.verifiedEmail ? "verified-signup" : "signup", plan: requestedPlan, trialGranted, trialFingerprintBlocked, trialDisabledByFlag }),
    });
    await this.audit.record({
      tenantId,
      actorId,
      eventType: "identity.user.created",
      entityType: "user",
      entityId: userId,
    });

    return {
      ok: true,
      value: {
        tenantId: tenantIdStr,
        orgId,
        userId,
        plan: trialGranted ? requestedPlan : "STARTER",
        trialGranted,
      },
    };
  }
}
