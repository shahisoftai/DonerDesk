import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import {
  PLAN_CATALOG,
  PLAN_CODES,
  resolvePlan,
  resolvePlanLimitsWithOverride,
  resolvePlanWithOverride,
  planLimitsToJson,
  mergePartialLimits,
  planCatalogOverrideToJson,
  isPlanCode,
  type PlanLimitsJson,
  type PlanCode,
  type PlanCatalogOverride,
  type PlanDefinition,
} from "@donordesk/domain";

export const PLATFORM_CATEGORIES = ["LLM", "EMAIL", "OBJECT_STORAGE", "BACKUP", "CONNECTOR"] as const;
export const PLATFORM_PROVIDERS = {
  LLM: ["openai", "anthropic", "deepseek", "minimax"],
  EMAIL: ["brevo", "postmark", "resend", "ses", "smtp"],
  OBJECT_STORAGE: ["cloudflare-r2", "backblaze-b2", "aws-s3", "s3-compatible"],
  BACKUP: ["cloudflare-r2", "backblaze-b2", "aws-s3", "s3-compatible"],
  CONNECTOR: ["kobotoolbox", "odk-central", "google-drive", "google-drive-oauth", "sharepoint", "s3-drop-folder"],
} as const;

export type PlatformSession = { sub: string; email: string; role: "SUPER_ADMIN"; purpose: "session" | "mfa" };
type AdminRow = { id: string; email: string; name: string; passwordHash: string; status: string; totpSecretEncrypted: string | null; recoveryCodesHash: string; failedLoginCount: number; lockedUntil: Date | null };
type ConfigurationRow = Record<string, unknown> & { id: string; secretCiphertext: string | null; secretIv: string | null; secretTag: string | null; secretVersion: number };
type BillingGrantRow = { id: string; tenantId: string; planCode: string; source: string; effectiveFrom: Date; effectiveUntil: Date | null; overrideLimitsJson: string | null; reason: string | null; billingSubscriptionId: string | null; createdAt: Date };
type BillingSubscriptionRow = { id: string; tenantId: string; planCode: string; status: string; currentPeriodEnd: Date | null; graceEndsAt: Date | null; billingInterval: string; unitAmountMinor: number };
type PlanCatalogOverrideRow = { planCode: string; name: string | null; monthlyPriceUsd: number | null; annualPriceUsd: number | null; trialDays: number | null; enabled: boolean | null; limitsJson: string | null; createdAt?: Date; updatedAt?: Date };

const GRANT_PRECEDENCE: Record<string, number> = { MANUAL: 0, ENTERPRISE_CONTRACT: 1, GRANDFATHERED: 2, CREEM_SUBSCRIPTION: 3, TRIAL: 4, DEFAULT: 5 };

export class PlatformControlPlane {
  private readonly masterKey: Buffer;
  private readonly jwtSecret: string;
  constructor(private readonly prisma: PrismaClient) {
    const raw = required("PLATFORM_MASTER_KEY");
    this.masterKey = Buffer.from(raw, "base64");
    if (this.masterKey.length !== 32) throw new Error("PLATFORM_MASTER_KEY must be a Base64-encoded 32-byte key");
    this.jwtSecret = required("SUPERADMIN_JWT_SECRET");
  }

  async bootstrap(email: string, name: string, temporaryPassword: string) {
    const count = (await this.query<{ count: bigint }>(`SELECT COUNT(*)::bigint AS count FROM "PlatformAdmin"`))[0]?.count ?? 0n;
    if (count > 0n) throw new Error("Platform administrator already exists");
    const id = randomUUID();
    await this.execute(`INSERT INTO "PlatformAdmin" ("id","email","name","passwordHash","updatedAt") VALUES ($1,$2,$3,$4,NOW())`, id, email.toLowerCase(), name, await bcrypt.hash(temporaryPassword, 12));
    return { id, email: email.toLowerCase(), name };
  }

  async login(email: string, password: string): Promise<{ sessionToken: string }> {
    const admin = (await this.query<AdminRow>(`SELECT * FROM "PlatformAdmin" WHERE "email"=$1 LIMIT 1`, email.toLowerCase()))[0];
    if (!admin || admin.status === "DISABLED") throw new Error("Invalid credentials");
    if (admin.lockedUntil && admin.lockedUntil > new Date()) throw new Error("Account temporarily locked");
    if (!await bcrypt.compare(password, admin.passwordHash)) {
      const attempts = admin.failedLoginCount + 1;
      await this.execute(`UPDATE "PlatformAdmin" SET "failedLoginCount"=$2,"lockedUntil"=$3,"updatedAt"=NOW() WHERE "id"=$1`, admin.id, attempts, attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null);
      throw new Error("Invalid credentials");
    }
    await this.execute(`UPDATE "PlatformAdmin" SET "failedLoginCount"=0,"lockedUntil"=NULL,"updatedAt"=NOW() WHERE "id"=$1`, admin.id);
    await this.execute(`UPDATE "PlatformAdmin" SET "lastLoginAt"=NOW(),"status"='ACTIVE',"updatedAt"=NOW() WHERE "id"=$1`, admin.id);
    return { sessionToken: this.sign(admin, "session", 1800) };
  }

  async beginMfa(token: string) {
    const session = this.verify(token, "mfa");
    const admin = await this.adminById(session.sub);
    if (admin.totpSecretEncrypted) throw new Error("MFA already configured");
    const secret = base32(randomBytes(20));
    await this.execute(`UPDATE "PlatformAdmin" SET "totpSecretEncrypted"=$2,"updatedAt"=NOW() WHERE "id"=$1`, admin.id, this.encryptString(secret));
    return { secret, uri: `otpauth://totp/DonorDesk%20SuperAdmin:${encodeURIComponent(admin.email)}?secret=${secret}&issuer=DonorDesk%20SuperAdmin&algorithm=SHA1&digits=6&period=30` };
  }

  async completeMfa(token: string, code: string): Promise<{ sessionToken: string; recoveryCodes?: string[] }> {
    const session = this.verify(token, "mfa");
    const admin = await this.adminById(session.sub);
    if (!admin.totpSecretEncrypted || !verifyTotp(this.decryptString(admin.totpSecretEncrypted), code)) throw new Error("Invalid authentication code");
    let recoveryCodes: string[] | undefined;
    let recoveryJson = admin.recoveryCodesHash;
    if (admin.recoveryCodesHash === "[]") {
      recoveryCodes = Array.from({ length: 10 }, () => randomBytes(5).toString("hex"));
      recoveryJson = JSON.stringify(recoveryCodes.map(hash));
    }
    await this.execute(`UPDATE "PlatformAdmin" SET "status"='ACTIVE',"lastLoginAt"=NOW(),"recoveryCodesHash"=$2,"updatedAt"=NOW() WHERE "id"=$1`, admin.id, recoveryJson);
    return { sessionToken: this.sign(admin, "session", 1800), recoveryCodes };
  }

  verifySession(token: string) { return this.verify(token, "session"); }

  async listConfigurations() {
    return (await this.query<ConfigurationRow>(`SELECT * FROM "PlatformConfiguration" ORDER BY "category","provider"`)).map(({ secretCiphertext, secretIv, secretTag, ...row }) => ({ ...row, secretConfigured: Boolean(secretCiphertext && secretIv && secretTag) }));
  }

  async upsertConfiguration(actor: PlatformSession, input: { id?: string; scopeType?: string; scopeId?: string; category: string; provider: string; displayName: string; enabled: boolean; configuration: Record<string, unknown>; secrets?: Record<string, string> }, meta?: { ip?: string; userAgent?: string }) {
    if (!PLATFORM_CATEGORIES.includes(input.category as never)) throw new Error("Unsupported configuration category");
    const providers = PLATFORM_PROVIDERS[input.category as keyof typeof PLATFORM_PROVIDERS] as readonly string[];
    if (!providers.includes(input.provider)) throw new Error("Unsupported provider");
    const existing = input.id ? (await this.query<ConfigurationRow>(`SELECT * FROM "PlatformConfiguration" WHERE "id"=$1`, input.id))[0] ?? null : null;
    const encrypted = input.secrets && Object.keys(input.secrets).length ? this.encrypt(JSON.stringify(input.secrets)) : null;
    const id = existing?.id ?? randomUUID(); const scopeType = input.scopeType ?? "GLOBAL"; const scopeId = input.scopeId ?? "GLOBAL";
    if (existing) await this.execute(`UPDATE "PlatformConfiguration" SET "scopeType"=$2,"scopeId"=$3,"category"=$4,"provider"=$5,"displayName"=$6,"enabled"=$7,"configurationJson"=$8,"updatedById"=$9,"secretCiphertext"=COALESCE($10,"secretCiphertext"),"secretIv"=COALESCE($11,"secretIv"),"secretTag"=COALESCE($12,"secretTag"),"secretVersion"=$13,"updatedAt"=NOW() WHERE "id"=$1`, id, scopeType, scopeId, input.category, input.provider, input.displayName, input.enabled, JSON.stringify(input.configuration), actor.sub, encrypted?.ciphertext ?? null, encrypted?.iv ?? null, encrypted?.tag ?? null, encrypted ? existing.secretVersion + 1 : existing.secretVersion);
    else await this.execute(`INSERT INTO "PlatformConfiguration" ("id","scopeType","scopeId","category","provider","displayName","enabled","configurationJson","secretCiphertext","secretIv","secretTag","createdById","updatedById","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,NOW())`, id, scopeType, scopeId, input.category, input.provider, input.displayName, input.enabled, JSON.stringify(input.configuration), encrypted?.ciphertext ?? null, encrypted?.iv ?? null, encrypted?.tag ?? null, actor.sub);
    await this.audit(actor, existing ? "configuration.updated" : "configuration.created", "PlatformConfiguration", id, existing, { ...input, secrets: encrypted ? "[ROTATED]" : "[UNCHANGED]" }, meta);
    return { id };
  }

  async deleteConfiguration(actor: PlatformSession, id: string, meta?: { ip?: string; userAgent?: string }) {
    const old = (await this.query<ConfigurationRow>(`DELETE FROM "PlatformConfiguration" WHERE "id"=$1 RETURNING *`, id))[0];
    if (!old) throw new Error("Configuration not found");
    await this.audit(actor, "configuration.deleted", "PlatformConfiguration", id, old, null, meta);
  }

  async overview() {
    const [tenants, users, configs, backups, connectors] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.query<{ count: bigint }>(`SELECT COUNT(*)::bigint AS count FROM "PlatformConfiguration"`).then(x => Number(x[0]?.count ?? 0)),
      this.query(`SELECT * FROM "BackupRun" ORDER BY "startedAt" DESC LIMIT 5`),
      this.query(`SELECT * FROM "ConnectorRun" ORDER BY "startedAt" DESC LIMIT 5`),
    ]);
    return { tenants, users, configurations: configs, backups, connectors };
  }
  listTenants() { return this.prisma.organization.findMany({ include: { _count: { select: { users: true, projects: true } } }, orderBy: { createdAt: "desc" } }); }
  listUsers() { return this.prisma.user.findMany({ select: { id: true, tenantId: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true }, orderBy: { createdAt: "desc" } }); }

  /**
   * Billing & tier overview for the SuperAdmin portal: one row per tenant with
   * the effective plan (resolved via the same precedence rules the app uses),
   * full effective limits, current-month usage, and the active subscription.
   * Pure read; uses the public domain calculators and merges global
   * `PlanCatalogOverride` rows so the portal never disagrees with tenant-facing
   * billing.
   */
  async listBilling() {
    const organizations = await this.prisma.organization.findMany({ orderBy: { createdAt: "desc" } });
    const grants = await this.query<BillingGrantRow>(`SELECT * FROM "EntitlementGrant"`);
    const subscriptions = await this.query<BillingSubscriptionRow>(`SELECT * FROM "BillingSubscription"`);
    const overrides = await this.catalogOverrides();

    const now = new Date();
    const subByTenant = new Map(subscriptions.map((s) => [s.tenantId, s]));
    const usage = await this.usageByTenant(now);

    return organizations.map((org) => this.billingRow(org, grants, subByTenant, usage, overrides, now));
  }

  /**
   * Comprehensive tier management read model: the merged global catalog (all
   * plans with applied overrides, tenant counts, enabled flags) plus the same
   * per-tenant rows as `listBilling`. Powers the dedicated "Tier management"
   * SuperAdmin area.
   */
  async listTiers() {
    const [overrides, billing] = await Promise.all([this.catalogOverrides(), this.listBilling()]);
    const tenantCountByPlan = new Map<string, number>();
    for (const row of billing) tenantCountByPlan.set(row.planCode, (tenantCountByPlan.get(row.planCode) ?? 0) + 1);

    const catalog = PLAN_CODES.map((code) => {
      const override = overrides.get(code);
      const definition: PlanDefinition = resolvePlanWithOverride(code, override);
      return {
        planCode: code,
        name: definition.name,
        monthlyPriceUsd: definition.monthlyPriceUsd,
        annualPriceUsd: definition.annualPriceUsd,
        trialDays: definition.trialDays,
        enabled: override?.enabled ?? true,
        overridden: Boolean(override),
        limits: planLimitsToJson({
          maxActiveProjects: definition.maxActiveProjects,
          maxSeats: definition.maxSeats,
          maxManagedStorageBytes: definition.maxManagedStorageBytes,
          monthlyAiDraftCredits: definition.monthlyAiDraftCredits,
        }),
        tenantCount: tenantCountByPlan.get(code) ?? 0,
      };
    });

    return { catalog, tenants: billing };
  }

  /**
   * Updates the global catalog override for a plan. Any provided field is
   * persisted; omitted fields keep the static catalog value. `limits` is a
   * partial PlanLimitsJson merged on top of the static catalog at resolution
   * time. Write the whole desired limits object from the UI to avoid
   * ambiguity; buckets sent as `null` mean unlimited for that tier.
   */
  async updateTier(actor: PlatformSession, planCode: string, input: { name?: string; monthlyPriceUsd?: number | null; annualPriceUsd?: number | null; trialDays?: number | null; enabled?: boolean; limits?: Partial<PlanLimitsJson> | null }, meta?: { ip?: string; userAgent?: string }) {
    if (!isPlanCode(planCode)) throw new Error("Unknown plan");
    const code = planCode as PlanCode;
    const existing = await this.planOverrideRow(code);
    const before = existing ? this.toCatalogOverride(existing) : null;

    const existingLimits = existing?.limitsJson ? this.parseLimitsJson(existing.limitsJson) : null;
    const staticDef = resolvePlan(code);
    const staticLimits = planLimitsToJson(staticDef);
    // Preserve explicit `null` buckets stored earlier (unlimited/custom): a
    // partial update must fall back to the *stored* override value first and
    // only then to the static catalog, so a stored null is never resurrected.
    const limitsJson = input.limits
      ? JSON.stringify(
          mergePartialLimits(input.limits, {
            maxActiveProjects: existingLimits !== null && existingLimits.maxActiveProjects !== undefined ? existingLimits.maxActiveProjects : staticLimits.maxActiveProjects,
            maxSeats: existingLimits !== null && existingLimits.maxSeats !== undefined ? existingLimits.maxSeats : staticLimits.maxSeats,
            maxManagedStorageBytes: existingLimits !== null && existingLimits.maxManagedStorageBytes !== undefined ? existingLimits.maxManagedStorageBytes : staticLimits.maxManagedStorageBytes,
            monthlyAiDraftCredits: existingLimits !== null && existingLimits.monthlyAiDraftCredits !== undefined ? existingLimits.monthlyAiDraftCredits : staticLimits.monthlyAiDraftCredits,
          }),
        )
      : existing?.limitsJson ?? null;

    await this.execute(
      `INSERT INTO "PlanCatalogOverride" ("planCode","name","monthlyPriceUsd","annualPriceUsd","trialDays","enabled","limitsJson","createdById","updatedById","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,NOW())
       ON CONFLICT ("planCode") DO UPDATE SET
         "name"=EXCLUDED."name",
         "monthlyPriceUsd"=EXCLUDED."monthlyPriceUsd",
         "annualPriceUsd"=EXCLUDED."annualPriceUsd",
         "trialDays"=EXCLUDED."trialDays",
         "enabled"=EXCLUDED."enabled",
         "limitsJson"=EXCLUDED."limitsJson",
         "updatedById"=EXCLUDED."updatedById",
         "updatedAt"=NOW()`,
      code,
      input.name !== undefined ? input.name : (existing?.name ?? staticDef.name),
      input.monthlyPriceUsd !== undefined ? input.monthlyPriceUsd : (existing?.monthlyPriceUsd ?? staticDef.monthlyPriceUsd),
      input.annualPriceUsd !== undefined ? input.annualPriceUsd : (existing?.annualPriceUsd ?? staticDef.annualPriceUsd),
      input.trialDays !== undefined ? input.trialDays : (existing?.trialDays ?? staticDef.trialDays),
      input.enabled ?? existing?.enabled ?? true,
      limitsJson,
      actor.sub,
      actor.sub,
    );

    const after = this.toCatalogOverride({
      planCode: code,
      name: input.name !== undefined ? input.name : (existing?.name ?? staticDef.name),
      monthlyPriceUsd: input.monthlyPriceUsd !== undefined ? input.monthlyPriceUsd : (existing?.monthlyPriceUsd ?? staticDef.monthlyPriceUsd),
      annualPriceUsd: input.annualPriceUsd !== undefined ? input.annualPriceUsd : (existing?.annualPriceUsd ?? staticDef.annualPriceUsd),
      trialDays: input.trialDays !== undefined ? input.trialDays : (existing?.trialDays ?? staticDef.trialDays),
      enabled: input.enabled ?? existing?.enabled ?? true,
      limitsJson,
    } as PlanCatalogOverrideRow);
    await this.audit(actor, "tier.updated", "PlanCatalogOverride", code, planCatalogOverrideToJson(before), planCatalogOverrideToJson(after), meta);
    return { planCode: code, ...planCatalogOverrideToJson(after) };
  }

  /** Removes the global override for a plan, reverting it to the static catalog. */
  async resetTier(actor: PlatformSession, planCode: string, meta?: { ip?: string; userAgent?: string }) {
    if (!isPlanCode(planCode)) throw new Error("Unknown plan");
    const existing = await this.planOverrideRow(planCode as PlanCode);
    if (!existing) throw new Error("Tier has no override to reset");
    await this.execute(`DELETE FROM "PlanCatalogOverride" WHERE "planCode"=$1`, planCode);
    await this.audit(actor, "tier.reset", "PlanCatalogOverride", planCode, planCatalogOverrideToJson(this.toCatalogOverride(existing)), null, meta);
    return { planCode, reset: true };
  }

  /**
   * Detailed tier view for one tenant: effective plan/source/limits, current
   * usage, active subscription, and the full grant history (append-only).
   */
  async getTenantTier(tenantId: string) {
    const org = await this.prisma.organization.findFirst({ where: { tenantId } });
    if (!org) throw new Error("Tenant not found");
    const [grants, subscriptions, usage, overrides] = await Promise.all([
      this.query<BillingGrantRow>(`SELECT * FROM "EntitlementGrant" WHERE "tenantId"=$1 ORDER BY "createdAt" DESC`, tenantId),
      this.query<BillingSubscriptionRow>(`SELECT * FROM "BillingSubscription" WHERE "tenantId"=$1`, tenantId),
      this.usageByTenant(new Date(), tenantId),
      this.catalogOverrides(),
    ]);
    const subByTenant = new Map(subscriptions.map((s) => [s.tenantId, s]));
    const row = this.billingRow(org, grants, subByTenant, usage, overrides, new Date());
    return {
      ...row,
      history: grants.map((g) => ({
        id: g.id,
        planCode: g.planCode,
        source: g.source,
        effectiveFrom: g.effectiveFrom.toISOString(),
        effectiveUntil: g.effectiveUntil?.toISOString() ?? null,
        reason: g.reason ?? null,
        overrideLimitsJson: g.overrideLimitsJson,
        createdAt: g.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Changes a tenant's tier by writing a MANUAL grant for the target plan.
   * The new grant takes effect immediately (MANUAL is the highest-precedence
   * source); limits resolve from the catalog/global overrides unless a partial
   * limits override is supplied. Append-only: previous grants remain for audit.
   */
  async changeTenantTier(actor: PlatformSession, tenantId: string, input: { planCode: PlanCode; reason?: string; limits?: Partial<PlanLimitsJson> | null }, meta?: { ip?: string; userAgent?: string }) {
    const org = await this.prisma.organization.findFirst({ where: { tenantId } });
    if (!org) throw new Error("Tenant not found");
    if (!isPlanCode(input.planCode)) throw new Error("Unknown plan");

    // A disabled tier is not assignable.
    const overrides = await this.catalogOverrides();
    const targetOverride = overrides.get(input.planCode);
    if (targetOverride?.enabled === false) throw new Error(`Tier ${input.planCode} is disabled and cannot be assigned`);

    const before = await this.currentPlanLimits(tenantId);
    const id = randomUUID();
    const now = new Date();
    // Partial limits merge against the *target* plan's limits (catalog +
    // global override), so unmentioned buckets follow the target tier instead
    // of silently carrying the old plan's allocation.
    const targetLimits = planLimitsToJson(resolvePlanLimitsWithOverride(input.planCode, targetOverride));
    const merged = input.limits ? mergePartialLimits(input.limits, targetLimits) : null;
    // Keep a stable "tier-change-to-*" marker in the reason so resetTenantTier
    // can identify tier-assignment grants; user reason text is preserved after.
    const reason = input.reason
      ? `tier-change-to-${input.planCode.toLowerCase()}:${input.reason}`
      : `tier-change-to-${input.planCode.toLowerCase()}`;
    await this.prisma.entitlementGrant.create({
      data: {
        id,
        tenantId,
        planCode: input.planCode,
        source: "MANUAL",
        effectiveFrom: now,
        overrideLimitsJson: merged ? JSON.stringify(merged) : null,
        reason,
        createdById: actor.sub,
      },
    });
    await this.audit(actor, "tenant.tier_changed", "Tenant", tenantId, { plan: before.planCode ?? "STARTER", source: before.source ?? "DEFAULT" }, { plan: input.planCode, source: "MANUAL", reason: input.reason ?? null, limits: merged }, meta);
    return { tenantId, previous: before.planCode ?? "STARTER", next: input.planCode, source: "MANUAL", limits: merged };
  }

  /**
   * Sets per-tenant feature allocation by writing a MANUAL grant with a full
   * PlanLimits override on the tenant's current effective plan. `limits` is a
   * PlanLimitsJson; `null` buckets mean unlimited for that tenant.
   */
  async setTenantLimits(actor: PlatformSession, tenantId: string, input: { limits: PlanLimitsJson; reason?: string }, meta?: { ip?: string; userAgent?: string }) {
    const org = await this.prisma.organization.findFirst({ where: { tenantId } });
    if (!org) throw new Error("Tenant not found");

    const before = await this.currentPlanLimits(tenantId);
    const id = randomUUID();
    const now = new Date();
    await this.prisma.entitlementGrant.create({
      data: {
        id,
        tenantId,
        planCode: before.planCode ?? "STARTER",
        source: "MANUAL",
        effectiveFrom: now,
        overrideLimitsJson: JSON.stringify(input.limits satisfies PlanLimitsJson),
        reason: input.reason ?? "tenant-limits-override",
        createdById: actor.sub,
      },
    });
    await this.audit(actor, "tenant.limits_set", "Tenant", tenantId, { plan: before.planCode ?? "STARTER", limits: { maxActiveProjects: before.maxActiveProjects, maxSeats: before.maxSeats, maxManagedStorageBytes: before.maxManagedStorageBytes, monthlyAiDraftCredits: before.monthlyAiDraftCredits } }, { plan: before.planCode ?? "STARTER", limits: input.limits }, meta);
    return { tenantId, planCode: before.planCode ?? "STARTER", limits: input.limits };
  }

  /**
   * Ends the tenant's MANUAL tier-assignment grants (written by
   * `changeTenantTier`) by closing their validity window, so the tenant falls
   * back to their subscription / trial / Starter entitlement. Grants are never
   * deleted — their window is ended for audit and rollback. Credit-allowance
   * and feature-allocation MANUAL grants are intentionally left intact.
   */
  async resetTenantTier(actor: PlatformSession, tenantId: string, meta?: { ip?: string; userAgent?: string }) {
    const org = await this.prisma.organization.findFirst({ where: { tenantId } });
    if (!org) throw new Error("Tenant not found");
    const now = new Date();
    const open = await this.prisma.entitlementGrant.findMany({
      where: { tenantId, source: "MANUAL", reason: { startsWith: "tier-change-to-" }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
      select: { id: true, planCode: true, effectiveUntil: true },
    });
    const closed = [];
    for (const grant of open) {
      await this.prisma.entitlementGrant.update({ where: { id: grant.id }, data: { effectiveUntil: now } });
      closed.push({ id: grant.id, planCode: grant.planCode });
    }
    const after = await this.currentPlanLimits(tenantId);
    await this.audit(actor, "tenant.tier_reset", "Tenant", tenantId, { closedGrants: closed }, { plan: after.planCode ?? "STARTER", source: after.source ?? "DEFAULT" }, meta);
    return { tenantId, closedGrants: closed, plan: after.planCode ?? "STARTER", source: after.source ?? "DEFAULT" };
  }

  /**
   * Adjusts a tenant's monthly AI-draft credit allowance by writing a MANUAL
   * entitlement grant with a full PlanLimits override (the highest-precedence
   * source). `mode`:
   *   - "SET"     -> allowance becomes `value` exactly
   *   - "INCREASE"-> allowance is current allowance + `value`
   *   - "DECREASE"-> allowance is current allowance - `value` (floored at 0)
   * Writing a new grant is append-only: previous grants remain for audit and
   * rollback, and the new MANUAL grant takes effect immediately.
   */
  async adjustCredits(actor: PlatformSession, tenantId: string, input: { mode: "SET" | "INCREASE" | "DECREASE"; value: number; reason?: string }, meta?: { ip?: string; userAgent?: string }) {
    const org = await this.prisma.organization.findFirst({ where: { tenantId } });
    if (!org) throw new Error("Tenant not found");
    if (!Number.isInteger(input.value) || input.value < 0) throw new Error("Credit value must be a non-negative integer");

    const current = await this.resolveCurrentAiCreditLimit(tenantId);
    const next = input.mode === "SET" ? input.value : input.mode === "INCREASE" ? current + input.value : Math.max(0, current - input.value);

    // Reuse the same limits the tenant currently has, only overriding the AI
    // credit bucket; keeps projects/seats/storage untouched.
    const base = await this.currentPlanLimits(tenantId);
    const override: PlanLimitsJson = {
      maxActiveProjects: base.maxActiveProjects,
      maxSeats: base.maxSeats,
      maxManagedStorageBytes: base.maxManagedStorageBytes,
      monthlyAiDraftCredits: next,
    };

    const id = randomUUID();
    const now = new Date();
    // Use the typed client (not raw SQL) so the Date is serialized as UTC —
    // raw parameters are bound in the session timezone (CEST on this host),
    // which would store a 2h-skewed timestamp and make the grant appear
    // future-dated to the effective-date filter.
    await this.prisma.entitlementGrant.create({
      data: {
        id,
        tenantId,
        planCode: base.planCode ?? "STARTER",
        source: "MANUAL",
        effectiveFrom: now,
        overrideLimitsJson: JSON.stringify(override),
        reason: input.reason ?? `ai-credits-${input.mode.toLowerCase()}`,
        createdById: actor.sub,
      },
    });
    await this.audit(actor, "billing.credits.adjusted", "Tenant", tenantId, { previous: current }, { mode: input.mode, value: input.value, next }, meta);
    return { tenantId, previous: current, next };
  }

  /** Resets the current UTC month's AI-credit usage counter to zero. */
  async resetCreditsCounter(actor: PlatformSession, tenantId: string, meta?: { ip?: string; userAgent?: string }) {
    const org = await this.prisma.organization.findFirst({ where: { tenantId } });
    if (!org) throw new Error("Tenant not found");
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    await this.execute(`UPDATE "UsageCounter" SET "used"=0,"reserved"=0,"updatedAt"=NOW() WHERE "tenantId"=$1 AND metric='AI_DRAFT_CREDITS' AND "periodStart"=$2`, tenantId, periodStart);
    await this.audit(actor, "billing.credits.counter_reset", "Tenant", tenantId, { periodStart: periodStart.toISOString() }, null, meta);
    return { tenantId, periodStart: periodStart.toISOString(), used: 0, reserved: 0 };
  }

  private async resolveCurrentAiCreditLimit(tenantId: string): Promise<number> {
    const plan = await this.currentPlanLimits(tenantId);
    return plan.monthlyAiDraftCredits ?? 0;
  }

  private async currentPlanLimits(tenantId: string): Promise<PlanLimitsJson & { planCode?: PlanCode; source?: string }> {
    const now = new Date();
    const grants = await this.query<BillingGrantRow>(`SELECT * FROM "EntitlementGrant" WHERE "tenantId"=$1`, tenantId);
    const subscriptions = await this.query<BillingSubscriptionRow>(`SELECT * FROM "BillingSubscription" WHERE "tenantId"=$1`, tenantId);
    const overrides = await this.catalogOverrides();
    const selected = this.selectEffectiveGrant(grants, subscriptions, now);
    const planCode = (isPlanCode(selected?.planCode ?? "") ? selected?.planCode : "STARTER") as PlanCode;
    const base = planLimitsToJson(resolvePlanLimitsWithOverride(planCode, overrides.get(planCode)));
    if (selected?.overrideLimitsJson) {
      try {
        const parsed = JSON.parse(selected.overrideLimitsJson) as PlanLimitsJson;
        if (typeof parsed.monthlyAiDraftCredits === "number") return { ...base, planCode, source: selected.source, monthlyAiDraftCredits: parsed.monthlyAiDraftCredits };
      } catch { /* ignore malformed override */ }
    }
    return { ...base, planCode, source: selected?.source };
  }

  /**
   * Resolves one tenant's billing row. Shares the exact precedence rules used
   * by the app's entitlement service (including subscription status/grace
   * effectiveness), plus global catalog overrides.
   */
  private billingRow(
    org: { id: string; tenantId: string; name: string; aiEnabled: boolean },
    grants: BillingGrantRow[],
    subByTenant: Map<string, BillingSubscriptionRow>,
    usage: Map<string, { activeProjects: number; seats: number; managedStorageBytes: bigint; aiUsed: bigint; aiReserved: bigint }>,
    overrides: Map<PlanCode, PlanCatalogOverride>,
    now: Date,
  ) {
    const selected = this.selectEffectiveGrant(grants.filter((g) => g.tenantId === org.tenantId), subByTenant, now);

    let planCode: PlanCode = "STARTER";
    let source = "DEFAULT";
    let overrideLimits: PlanLimitsJson | undefined;
    if (selected) {
      planCode = (isPlanCode(selected.planCode) ? selected.planCode : "STARTER") as PlanCode;
      source = selected.source;
      if (selected.overrideLimitsJson) {
        try { overrideLimits = JSON.parse(selected.overrideLimitsJson) as PlanLimitsJson; } catch { /* keep undefined */ }
      }
    }

    const limits = overrideLimits ?? planLimitsToJson(resolvePlanLimitsWithOverride(planCode, overrides.get(planCode)));
    const counter = usage.get(org.tenantId);
    const subscription = subByTenant.get(org.tenantId);

    return {
      tenantId: org.tenantId,
      organizationId: org.id,
      name: org.name,
      aiEnabled: org.aiEnabled,
      planCode,
      source,
      planName: PLAN_CATALOG[planCode]?.name ?? planCode,
      limits,
      monthlyAiDraftCredits: limits.monthlyAiDraftCredits,
      aiCreditsUsed: Number(counter?.aiUsed ?? 0n),
      aiCreditsReserved: Number(counter?.aiReserved ?? 0n),
      usage: {
        projects: counter?.activeProjects ?? 0,
        seats: counter?.seats ?? 0,
        managedStorageBytes: (counter?.managedStorageBytes ?? 0n).toString(),
        aiDraftCredits: Number(counter?.aiUsed ?? 0n),
      },
      overrideApplied: Boolean(overrideLimits),
      subscription: subscription ? { status: subscription.status, planCode: subscription.planCode, interval: subscription.billingInterval, unitAmountMinor: subscription.unitAmountMinor, currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null } : null,
    };
  }

  /**
   * Shared effective-grant selector used by the portal reads. Mirrors the app's
   * `calculateEntitlement`: only grants effective at `now` (including
   * subscription status/grace for CREEM_SUBSCRIPTION grants) are considered,
   * highest-precedence source wins, and ties resolve to the most recent grant.
   */
  private selectEffectiveGrant(tenantGrants: BillingGrantRow[], subscriptions: BillingSubscriptionRow[] | Map<string, BillingSubscriptionRow>, now: Date): BillingGrantRow | undefined {
    const subByTenant = subscriptions instanceof Map ? subscriptions : new Map(subscriptions.map((s) => [s.tenantId, s]));
    const effective = tenantGrants.filter((g) => {
      if (g.effectiveFrom.getTime() > now.getTime()) return false;
      if (g.effectiveUntil && g.effectiveUntil.getTime() <= now.getTime()) return false;
      if (g.source === "CREEM_SUBSCRIPTION") {
        const sub = g.billingSubscriptionId ? [...subByTenant.values()].find((s) => s.id === g.billingSubscriptionId) : subByTenant.get(g.tenantId);
        if (sub) {
          if (sub.status === "CANCELLED" || sub.status === "EXPIRED" || sub.status === "PAUSED") return false;
          if (sub.status === "PAST_DUE") {
            if (!sub.graceEndsAt || sub.graceEndsAt.getTime() <= now.getTime()) return false;
          }
          if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < now.getTime()) return false;
        }
      }
      return true;
    });
    return [...effective].sort((a, b) => {
      const p = (GRANT_PRECEDENCE[a.source] ?? 9) - (GRANT_PRECEDENCE[b.source] ?? 9);
      if (p !== 0) return p;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })[0];
  }

  /** Current UTC-month usage per tenant (optionally filtered to one tenant). */
  private async usageByTenant(now: Date, tenantId?: string) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const tenantFilter = tenantId ? { tenantId } : {};
    const [projects, users, storageRows, aiRows] = await Promise.all([
      this.prisma.project.groupBy({ by: ["tenantId"], where: { ...tenantFilter, status: { not: "ARCHIVED" } }, _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ["tenantId"], where: { ...tenantFilter, status: { in: ["ACTIVE", "INVITED", "SUSPENDED"] } }, _count: { _all: true } }),
      this.query<{ tenantId: string; used: bigint; reserved: bigint }>(`SELECT "tenantId","used","reserved" FROM "UsageCounter" WHERE metric='MANAGED_STORAGE_BYTES' AND "periodStart">=$1 AND "periodStart"<$2`, monthStart, monthEnd),
      this.query<{ tenantId: string; used: bigint; reserved: bigint }>(`SELECT "tenantId","used","reserved" FROM "UsageCounter" WHERE metric='AI_DRAFT_CREDITS' AND "periodStart">=$1 AND "periodStart"<$2`, monthStart, monthEnd),
    ]);
    const map = new Map<string, { activeProjects: number; seats: number; managedStorageBytes: bigint; aiUsed: bigint; aiReserved: bigint }>();
    for (const row of projects) map.set(row.tenantId, { activeProjects: row._count._all, seats: 0, managedStorageBytes: 0n, aiUsed: 0n, aiReserved: 0n });
    for (const row of users) {
      const entry = map.get(row.tenantId) ?? { activeProjects: 0, seats: 0, managedStorageBytes: 0n, aiUsed: 0n, aiReserved: 0n };
      entry.seats = row._count._all;
      map.set(row.tenantId, entry);
    }
    for (const row of storageRows) {
      const entry = map.get(row.tenantId) ?? { activeProjects: 0, seats: 0, managedStorageBytes: 0n, aiUsed: 0n, aiReserved: 0n };
      entry.managedStorageBytes = row.used;
      map.set(row.tenantId, entry);
    }
    for (const row of aiRows) {
      const entry = map.get(row.tenantId) ?? { activeProjects: 0, seats: 0, managedStorageBytes: 0n, aiUsed: 0n, aiReserved: 0n };
      entry.aiUsed = row.used;
      entry.aiReserved = row.reserved;
      map.set(row.tenantId, entry);
    }
    return map;
  }

  /** All global catalog overrides keyed by plan code. */
  private async catalogOverrides(): Promise<Map<PlanCode, PlanCatalogOverride>> {
    const rows = await this.query<PlanCatalogOverrideRow>(`SELECT * FROM "PlanCatalogOverride"`);
    const map = new Map<PlanCode, PlanCatalogOverride>();
    for (const row of rows) {
      const override = this.toCatalogOverride(row);
      if (override) map.set(row.planCode as PlanCode, override);
    }
    return map;
  }

  private async planOverrideRow(planCode: PlanCode): Promise<PlanCatalogOverrideRow | null> {
    return (await this.query<PlanCatalogOverrideRow>(`SELECT * FROM "PlanCatalogOverride" WHERE "planCode"=$1`, planCode))[0] ?? null;
  }

  private toCatalogOverride(row: PlanCatalogOverrideRow | null | undefined): PlanCatalogOverride | null {
    if (!row) return null;
    const override: PlanCatalogOverride = { planCode: row.planCode as PlanCode };
    override.name = row.name ?? undefined;
    override.monthlyPriceUsd = row.monthlyPriceUsd;
    override.annualPriceUsd = row.annualPriceUsd;
    override.trialDays = row.trialDays;
    override.enabled = row.enabled ?? true;
    const parsed = row.limitsJson ? this.parseLimitsJson(row.limitsJson) : null;
    if (parsed) override.limits = {
      ...(parsed.maxActiveProjects !== undefined ? { maxActiveProjects: parsed.maxActiveProjects } : {}),
      ...(parsed.maxSeats !== undefined ? { maxSeats: parsed.maxSeats } : {}),
      ...(parsed.maxManagedStorageBytes !== undefined ? { maxManagedStorageBytes: parsed.maxManagedStorageBytes === null ? null : BigInt(parsed.maxManagedStorageBytes) } : {}),
      ...(parsed.monthlyAiDraftCredits !== undefined ? { monthlyAiDraftCredits: parsed.monthlyAiDraftCredits } : {}),
    };
    return override;
  }

  private parseLimitsJson(json: string): Partial<PlanLimitsJson> | null {
    try {
      const parsed = JSON.parse(json) as Partial<PlanLimitsJson>;
      return {
        ...(parsed.maxActiveProjects !== undefined ? { maxActiveProjects: parsed.maxActiveProjects } : {}),
        ...(parsed.maxSeats !== undefined ? { maxSeats: parsed.maxSeats } : {}),
        ...(parsed.maxManagedStorageBytes !== undefined ? { maxManagedStorageBytes: parsed.maxManagedStorageBytes } : {}),
        ...(parsed.monthlyAiDraftCredits !== undefined ? { monthlyAiDraftCredits: parsed.monthlyAiDraftCredits } : {}),
      };
    } catch {
      return null;
    }
  }

  async createTenant(actor: PlatformSession, data: { name: string; tenantId: string; organizationType: string; country: string; sectors: string[]; contactName: string; contactEmail: string; website?: string; defaultLanguage: string; dataResidency: string; aiEnabled: boolean }, meta?: { ip?: string; userAgent?: string }) {
    const created = await this.prisma.organization.create({ data: { id: randomUUID(), ...data, tenantId: data.tenantId.toLowerCase(), sectors: JSON.stringify(data.sectors), website: data.website || null } });
    await this.audit(actor, "tenant.created", "Organization", created.id, null, created, meta); return created;
  }
  async updateTenant(actor: PlatformSession, id: string, data: Partial<{ name: string; organizationType: string; country: string; sectors: string[]; contactName: string; contactEmail: string; website: string; defaultLanguage: string; dataResidency: string; aiEnabled: boolean }>, meta?: { ip?: string; userAgent?: string }) {
    const old = await this.prisma.organization.findUniqueOrThrow({ where: { id } });
    const { sectors, website, ...rest } = data;
    const updated = await this.prisma.organization.update({ where: { id }, data: { ...rest, ...(sectors ? { sectors: JSON.stringify(sectors) } : {}), ...(website !== undefined ? { website: website || null } : {}) } });
    await this.audit(actor, "tenant.updated", "Organization", id, old, updated, meta); return updated;
  }
  async deleteTenant(actor: PlatformSession, id: string, confirmation: string, meta?: { ip?: string; userAgent?: string }) {
    const old = await this.prisma.organization.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: true, projects: true } } } });
    if (confirmation !== old.name) throw new Error("Tenant name confirmation does not match");
    if (old._count.users || old._count.projects) throw new Error("Tenant must have no users or projects before deletion");
    await this.prisma.organization.delete({ where: { id } }); await this.audit(actor, "tenant.deleted", "Organization", id, old, null, meta);
  }
  async createUser(actor: PlatformSession, data: { tenantId: string; email: string; name: string; role: string; status: string; password: string }, meta?: { ip?: string; userAgent?: string }) {
    const created = await this.prisma.user.create({ data: { id: randomUUID(), tenantId: data.tenantId, email: data.email.toLowerCase(), name: data.name, role: data.role, status: data.status, passwordHash: await bcrypt.hash(data.password, 12) } });
    await this.audit(actor, "user.created", "User", created.id, null, { ...created, passwordHash: "[HASHED]" }, meta); return { ...created, passwordHash: undefined };
  }
  async updateUser(actor: PlatformSession, id: string, data: { name?: string; status?: string; role?: string; password?: string }, meta?: { ip?: string; userAgent?: string }) {
    const old = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.user.update({ where: { id }, data: { name: data.name, status: data.status, role: data.role, ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 12) } : {}) } });
    await this.audit(actor, data.password ? "user.password_reset" : "user.updated", "User", id, old, { ...data, password: data.password ? "[RESET]" : undefined }, meta);
    return updated;
  }
  async deleteUser(actor: PlatformSession, id: string, meta?: { ip?: string; userAgent?: string }) { const old = await this.prisma.user.delete({ where: { id } }); await this.audit(actor, "user.deleted", "User", id, old, null, meta); }

  async testConfiguration(actor: PlatformSession, id: string, meta?: { ip?: string; userAgent?: string }) {
    const row = (await this.query<ConfigurationRow>(`SELECT * FROM "PlatformConfiguration" WHERE "id"=$1`, id))[0];
    if (!row) throw new Error("Configuration not found");
    let status = "FAILED", message = "Credentials could not be verified";
    try {
      const secrets = row.secretCiphertext && row.secretIv && row.secretTag ? JSON.parse(this.decrypt({ ciphertext: row.secretCiphertext, iv: row.secretIv, tag: row.secretTag })) as Record<string, string> : {};
      const configuration = JSON.parse(String(row.configurationJson || "{}")) as Record<string, unknown>;
      const result = await testProvider(String(row.category), String(row.provider), configuration, secrets);
      status = result.ok ? "SUCCESS" : "FAILED"; message = result.message;
    } catch (error) { message = error instanceof Error ? error.message : "Connection test failed"; }
    await this.execute(`UPDATE "PlatformConfiguration" SET "lastTestStatus"=$2,"lastTestMessage"=$3,"lastTestedAt"=NOW(),"updatedAt"=NOW() WHERE "id"=$1`, id, status, message.slice(0, 500));
    await this.audit(actor, "configuration.tested", "PlatformConfiguration", id, null, { status, message }, meta); return { status, message };
  }

  async audit(actor: PlatformSession, action: string, entityType: string, entityId: string, oldValue: unknown, newValue: unknown, meta?: { ip?: string; userAgent?: string }) {
    const previous = (await this.query<{ hash: string }>(`SELECT "hash" FROM "PlatformAuditEvent" ORDER BY "createdAt" DESC LIMIT 1`))[0];
    const createdAt = new Date(); const prevHash = previous?.hash ?? "";
    const body = JSON.stringify({ actorId: actor.sub, action, entityType, entityId, oldValue, newValue, createdAt: createdAt.toISOString(), prevHash });
    const id = randomUUID(); await this.execute(`INSERT INTO "PlatformAuditEvent" ("id","actorId","action","entityType","entityId","oldValue","newValue","ipAddress","userAgent","prevHash","hash","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, id, actor.sub, action, entityType, entityId, oldValue == null ? null : JSON.stringify(oldValue), newValue == null ? null : JSON.stringify(newValue), meta?.ip ?? null, meta?.userAgent ?? null, prevHash, hash(body), createdAt); return { id };
  }
  listAudit() { return this.query(`SELECT * FROM "PlatformAuditEvent" ORDER BY "createdAt" DESC LIMIT 250`); }

  private sign(admin: { id: string; email: string }, purpose: PlatformSession["purpose"], ttl: number) { return jwt.sign({ sub: admin.id, email: admin.email, role: "SUPER_ADMIN", purpose }, this.jwtSecret, { algorithm: "HS256", issuer: "donordesk-superadmin", audience: "donordesk-superadmin", expiresIn: ttl }); }
  private verify(token: string, purpose: PlatformSession["purpose"]): PlatformSession { const value = jwt.verify(token, this.jwtSecret, { algorithms: ["HS256"], issuer: "donordesk-superadmin", audience: "donordesk-superadmin" }) as PlatformSession; if (value.role !== "SUPER_ADMIN" || value.purpose !== purpose) throw new Error("Invalid SuperAdmin session"); return value; }
  private async adminById(id: string) { const row = (await this.query<AdminRow>(`SELECT * FROM "PlatformAdmin" WHERE "id"=$1 LIMIT 1`, id))[0]; if (!row) throw new Error("Platform administrator not found"); return row; }
  private query<T = Record<string, unknown>>(sql: string, ...values: unknown[]) { return this.prisma.$queryRawUnsafe<T[]>(sql, ...values); }
  private execute(sql: string, ...values: unknown[]) { return this.prisma.$executeRawUnsafe(sql, ...values); }
  private encryptString(value: string) { const e = this.encrypt(value); return `${e.iv}.${e.tag}.${e.ciphertext}`; }
  private decryptString(value: string) { const [iv, tag, ciphertext] = value.split("."); if (!iv || !tag || !ciphertext) throw new Error("Invalid encrypted value"); const d = createDecipheriv("aes-256-gcm", this.masterKey, Buffer.from(iv, "base64")); d.setAuthTag(Buffer.from(tag, "base64")); return Buffer.concat([d.update(Buffer.from(ciphertext, "base64")), d.final()]).toString(); }
  private decrypt(value: { ciphertext: string; iv: string; tag: string }) { const d = createDecipheriv("aes-256-gcm", this.masterKey, Buffer.from(value.iv, "base64")); d.setAuthTag(Buffer.from(value.tag, "base64")); return Buffer.concat([d.update(Buffer.from(value.ciphertext, "base64")), d.final()]).toString(); }
  private encrypt(value: string) { const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", this.masterKey, iv); const encrypted = Buffer.concat([c.update(value), c.final()]); return { ciphertext: encrypted.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") }; }
}

function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value; }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(input: Buffer) { let bits = ""; for (const byte of input) bits += byte.toString(2).padStart(8, "0"); let out = ""; for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)]; return out; }
function decode32(value: string) { let bits = ""; for (const char of value.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0"); return Buffer.from((bits.match(/.{8}/g) ?? []).map(x => parseInt(x, 2))); }
function verifyTotp(secret: string, code: string) { if (!/^\d{6}$/.test(code)) return false; const step = Math.floor(Date.now() / 30_000); for (let drift = -1; drift <= 1; drift++) { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(step + drift)); const h = createHmac("sha1", decode32(secret)).update(b).digest(); const o = h[19]! & 15; const expected = String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0"); if (timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return true; } return false; }

async function testProvider(category: string, provider: string, config: Record<string, unknown>, secrets: Record<string, string>) {
  let url = "", headers: Record<string, string> = {};
  if (category === "LLM") {
    const defaults: Record<string, string> = { openai: "https://api.openai.com/v1/models", anthropic: "https://api.anthropic.com/v1/models", deepseek: "https://api.deepseek.com/models", minimax: "https://api.minimax.io/v1/models" };
    // Test the configured base URL (not just the default) so a malformed or
    // unreachable baseUrl is caught here instead of failing at runtime.
    const paths: Record<string, string> = { openai: "/models", anthropic: "/v1/models", deepseek: "/models", minimax: "/v1/models" };
    const baseUrl = typeof config.baseUrl === "string" && config.baseUrl.trim() ? config.baseUrl.trim().replace(/\/+$/, "") : "";
    url = String(config.testUrl || (baseUrl ? `${baseUrl}${paths[provider] ?? ""}` : defaults[provider] || ""));
    const key = secrets.apiKey;
    if (!key) throw new Error("API key is required");
    headers = provider === "anthropic" ? { "x-api-key": key, "anthropic-version": "2023-06-01" } : { authorization: `Bearer ${key}` };
  } else if (category === "EMAIL" && provider === "brevo") { url = "https://api.brevo.com/v3/account"; headers = { "api-key": secrets.apiKey || "" }; }
  else if (category === "EMAIL" && provider === "resend") { url = "https://api.resend.com/domains"; headers = { authorization: `Bearer ${secrets.apiKey || ""}` }; }
  else if (category === "EMAIL" && provider === "postmark") { url = "https://api.postmarkapp.com/server"; headers = { "X-Postmark-Server-Token": secrets.serverToken || "" }; }
  else return { ok: Boolean(Object.keys(secrets).length), message: Object.keys(secrets).length ? "Credentials encrypted and configuration validated; live protocol test is performed by its worker adapter" : "No credentials are configured" };
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  return { ok: response.ok, message: response.ok ? "Connection and credentials verified" : `Provider returned HTTP ${response.status}` };
}
