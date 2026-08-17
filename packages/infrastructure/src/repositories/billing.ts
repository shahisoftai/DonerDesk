import { PrismaClient } from "@prisma/client";
import {
  BillingSubscription,
  EntitlementGrant,
  TenantId,
  DomainError,
  type Result,
  type UsageMetric,
  UsageCounter,
} from "@donordesk/domain";
import type {
  IEntitlementGrantRepository,
  IBillingSubscriptionRepository,
  IUsageCounterRepository,
  IBillingEventInboxRepository,
  ITrialIdentityRepository,
  ILlmUsageRepository,
} from "@donordesk/application";

type DbClient = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function err<T = never>(e: DomainError): Result<T, DomainError> {
  return { ok: false, error: e };
}

export class PrismaBillingSubscriptionRepository implements IBillingSubscriptionRepository {
  constructor(private readonly prisma: DbClient) {}

  async create(sub: BillingSubscription): Promise<Result<BillingSubscription, DomainError>> {
    try {
      await this.prisma.billingSubscription.create({
        data: {
          id: sub.id,
          tenantId: sub.tenantId,
          provider: sub.provider,
          providerCustomerId: sub.providerCustomerId,
          providerSubscriptionId: sub.providerSubscriptionId,
          providerProductId: sub.providerProductId,
          planCode: sub.planCode,
          catalogVersion: sub.catalogVersion,
          status: sub.status,
          currency: sub.currency,
          unitAmountMinor: sub.unitAmountMinor,
          billingInterval: sub.billingInterval,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          trialStart: sub.trialStart,
          trialEnd: sub.trialEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          canceledAt: sub.canceledAt,
          graceEndsAt: sub.graceEndsAt,
          providerUpdatedAt: sub.providerUpdatedAt,
          lastSyncedAt: sub.lastSyncedAt,
        },
      });
      return ok(sub);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async update(sub: BillingSubscription): Promise<Result<BillingSubscription, DomainError>> {
    try {
      await this.prisma.billingSubscription.update({
        where: { id: sub.id },
        data: {
          providerCustomerId: sub.providerCustomerId,
          providerSubscriptionId: sub.providerSubscriptionId,
          providerProductId: sub.providerProductId,
          planCode: sub.planCode,
          catalogVersion: sub.catalogVersion,
          status: sub.status,
          currency: sub.currency,
          unitAmountMinor: sub.unitAmountMinor,
          billingInterval: sub.billingInterval,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          trialStart: sub.trialStart,
          trialEnd: sub.trialEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          canceledAt: sub.canceledAt,
          graceEndsAt: sub.graceEndsAt,
          providerUpdatedAt: sub.providerUpdatedAt,
          lastSyncedAt: sub.lastSyncedAt,
        },
      });
      return ok(sub);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async findByProviderSubscriptionId(providerSubscriptionId: string): Promise<Result<BillingSubscription | null, DomainError>> {
    const row = await this.prisma.billingSubscription.findUnique({
      where: { provider_providerSubscriptionId: { provider: "CREEM", providerSubscriptionId } },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findAccessGrantingByTenant(tenantId: string): Promise<Result<BillingSubscription | null, DomainError>> {
    const row = await this.prisma.billingSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    provider: string;
    providerCustomerId: string;
    providerSubscriptionId: string;
    providerProductId: string;
    planCode: string;
    catalogVersion: number;
    status: string;
    currency: string;
    unitAmountMinor: number;
    billingInterval: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    trialStart: Date | null;
    trialEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    graceEndsAt: Date | null;
    providerUpdatedAt: Date | null;
    lastSyncedAt: Date | null;
    createdAt: Date;
  }): BillingSubscription {
    return BillingSubscription.rehydrate({
      id: row.id,
      createdAt: row.createdAt,
      props: {
        tenantId: row.tenantId,
        provider: row.provider as import("@donordesk/domain").BillingProviderCode,
        providerCustomerId: row.providerCustomerId,
        providerSubscriptionId: row.providerSubscriptionId,
        providerProductId: row.providerProductId,
        planCode: row.planCode as import("@donordesk/domain").PlanCode,
        catalogVersion: row.catalogVersion,
        status: row.status as import("@donordesk/domain").BillingSubscriptionStatus,
        currency: row.currency,
        unitAmountMinor: row.unitAmountMinor,
        billingInterval: row.billingInterval as import("@donordesk/domain").BillingInterval,
        currentPeriodStart: row.currentPeriodStart ?? undefined,
        currentPeriodEnd: row.currentPeriodEnd ?? undefined,
        trialStart: row.trialStart ?? undefined,
        trialEnd: row.trialEnd ?? undefined,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        canceledAt: row.canceledAt ?? undefined,
        graceEndsAt: row.graceEndsAt ?? undefined,
        providerUpdatedAt: row.providerUpdatedAt ?? undefined,
        lastSyncedAt: row.lastSyncedAt ?? undefined,
      },
    });
  }
}

export class PrismaEntitlementGrantRepository implements IEntitlementGrantRepository {
  constructor(private readonly prisma: DbClient) {}

  async create(grant: EntitlementGrant): Promise<Result<EntitlementGrant, DomainError>> {
    try {
      await this.prisma.entitlementGrant.create({
        data: {
          id: grant.id,
          tenantId: grant.tenantId,
          planCode: grant.planCode,
          source: grant.source,
          effectiveFrom: grant.effectiveFrom,
          effectiveUntil: grant.effectiveUntil,
          billingSubscriptionId: grant.billingSubscriptionId,
          overrideLimitsJson: grant.overrideLimitsJson ?? undefined,
          reason: grant.reason,
          createdById: grant.createdById,
        },
      });
      return ok(grant);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async listByTenant(tenantId: string): Promise<Result<EntitlementGrant[], DomainError>> {
    const rows = await this.prisma.entitlementGrant.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async listEffectiveByTenant(tenantId: string, now: Date): Promise<Result<EntitlementGrant[], DomainError>> {
    const rows = await this.prisma.entitlementGrant.findMany({
      where: { tenantId, effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
      orderBy: { createdAt: "asc" },
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async listExpiredTrialGrants(now: Date): Promise<Result<EntitlementGrant[], DomainError>> {
    const rows = await this.prisma.entitlementGrant.findMany({
      where: { source: "TRIAL", effectiveUntil: { not: null, lte: now } },
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    planCode: string;
    source: string;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
    billingSubscriptionId: string | null;
    overrideLimitsJson: string | null;
    reason: string | null;
    createdById: string | null;
    createdAt: Date;
  }): EntitlementGrant {
    return EntitlementGrant.rehydrate({
      id: row.id,
      createdAt: row.createdAt,
      props: {
        tenantId: row.tenantId,
        planCode: row.planCode as import("@donordesk/domain").PlanCode,
        source: row.source as import("@donordesk/domain").EntitlementSource,
        effectiveFrom: row.effectiveFrom,
        effectiveUntil: row.effectiveUntil ?? undefined,
        billingSubscriptionId: row.billingSubscriptionId ?? undefined,
        overrideLimitsJson: row.overrideLimitsJson,
        reason: row.reason ?? undefined,
        createdById: row.createdById ?? undefined,
      },
    });
  }
}

export class PrismaUsageCounterRepository implements IUsageCounterRepository {
  constructor(private readonly prisma: DbClient) {}

  async get(tenantId: string, metric: UsageMetric, periodStart: Date): Promise<Result<UsageCounter, DomainError>> {
    let row = await this.prisma.usageCounter.findUnique({
      where: { tenantId_metric_periodStart: { tenantId, metric, periodStart } },
    });
    if (!row) {
      try {
        row = await this.prisma.usageCounter.create({
          data: { id: randomId(), tenantId, metric, periodStart },
        });
      } catch {
        row = await this.prisma.usageCounter.findUnique({
          where: { tenantId_metric_periodStart: { tenantId, metric, periodStart } },
        });
      }
    }
    if (!row) return err(new DomainError("INVARIANT_VIOLATION", "Usage counter unavailable"));
    return ok(this.toDomain(row));
  }

  async add(tenantId: string, metric: UsageMetric, periodStart: Date, delta: bigint): Promise<Result<UsageCounter, DomainError>> {
    if (delta === 0n) return this.get(tenantId, metric, periodStart);
    // Atomic upsert: create the row when absent, then increment atomically.
    await this.prisma.usageCounter.upsert({
      where: { tenantId_metric_periodStart: { tenantId, metric, periodStart } },
      create: { id: randomId(), tenantId, metric, periodStart },
      update: {},
    });
    const updated = await this.prisma.usageCounter.update({
      where: { tenantId_metric_periodStart: { tenantId, metric, periodStart } },
      data: { used: { increment: delta } },
    });
    return ok(this.toDomain(updated));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    metric: string;
    periodStart: Date;
    used: bigint;
    reserved: bigint;
  }): UsageCounter {
    return UsageCounter.create({
      metric: row.metric as UsageMetric,
      periodStart: row.periodStart,
      used: row.used,
      reserved: row.reserved,
    });
  }
}

export class PrismaBillingEventInboxRepository implements IBillingEventInboxRepository {
  constructor(private readonly prisma: DbClient) {}

  async create(input: {
    id: string;
    provider: string;
    providerEventId: string;
    eventType: string;
    providerCreatedAt?: Date;
    tenantId?: string;
    payloadChecksum: string;
  }): Promise<Result<{ id: string }, DomainError>> {
    try {
      await this.prisma.billingEventInbox.create({
        data: {
          id: input.id,
          provider: input.provider,
          providerEventId: input.providerEventId,
          eventType: input.eventType,
          providerCreatedAt: input.providerCreatedAt,
          tenantId: input.tenantId,
          payloadChecksum: input.payloadChecksum,
        },
      });
      return ok({ id: input.id });
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async markProcessing(id: string, attempt: number): Promise<Result<void, DomainError>> {
    await this.prisma.billingEventInbox.update({ where: { id }, data: { status: "PROCESSING", attemptCount: attempt } });
    return ok(undefined);
  }

  async markProcessed(id: string): Promise<Result<void, DomainError>> {
    await this.prisma.billingEventInbox.update({ where: { id }, data: { status: "PROCESSED", processedAt: new Date() } });
    return ok(undefined);
  }

  async markFailed(id: string, error: string): Promise<Result<void, DomainError>> {
    await this.prisma.billingEventInbox.update({ where: { id }, data: { status: "FAILED", lastError: error.slice(0, 2000) } });
    return ok(undefined);
  }
}

export class PrismaTrialIdentityRepository implements ITrialIdentityRepository {
  constructor(private readonly prisma: DbClient) {}

  async existsByEmailFingerprint(fingerprint: string): Promise<Result<boolean, DomainError>> {
    const row = await this.prisma.trialIdentity.findUnique({ where: { emailFingerprint: fingerprint }, select: { id: true } });
    return ok(Boolean(row));
  }

  async create(input: {
    id: string;
    tenantId: string;
    emailFingerprint: string;
    domainFingerprint: string;
    trialStartedAt: Date;
    trialEndedAt?: Date;
  }): Promise<Result<{ id: string }, DomainError>> {
    try {
      await this.prisma.trialIdentity.create({ data: { ...input } });
      return ok({ id: input.id });
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }
}

export class PrismaLlmUsageRepository implements ILlmUsageRepository {
  constructor(private readonly prisma: DbClient) {}

  async countSuccessfulReportDrafts(tenantId: string, monthStart: Date): Promise<Result<number, DomainError>> {
    const monthEnd = new Date(monthStart.getTime() + 31 * 24 * 60 * 60 * 1000);
    const count = await this.prisma.llmRun.count({
      where: {
        tenantId,
        operationType: "REPORT_DRAFT",
        status: "success",
        createdAt: { gte: monthStart, lt: monthEnd },
      },
    });
    return ok(count);
  }

  async countAiReportDrafts(tenantId: string, monthStart: Date): Promise<Result<number, DomainError>> {
    const monthEnd = new Date(monthStart.getTime() + 31 * 24 * 60 * 60 * 1000);
    const count = await this.prisma.llmRun.count({
      where: {
        tenantId,
        operationType: "REPORT_DRAFT",
        status: "success",
        modelId: { not: "stub" },
        createdAt: { gte: monthStart, lt: monthEnd },
      },
    });
    return ok(count);
  }

  async recordRun(input: {
    id: string;
    tenantId: string;
    operationType: string;
    resourceId?: string;
    modelId: string;
    promptId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    latencyMs: number;
    status: string;
    promptVersion: number;
    modelVersion: string;
    billableUnits?: number;
    requestId?: string;
  }): Promise<Result<{ id: string }, DomainError>> {
    try {
      // LlmRun.modelId is a foreign key to LlmModel. Ensure the model row
      // exists so ledger inserts actually record (previously these silently
      // failed the FK check, leaving the AI usage ledger empty).
      await this.prisma.llmModel.upsert({
        where: { id: input.modelId },
        create: {
          id: input.modelId,
          name: input.modelId,
          provider: input.modelId,
          version: input.modelVersion,
          capabilities: JSON.stringify(["chat"]),
        },
        update: {},
      });
      // LlmRun.promptId is a foreign key to LlmPrompt. Ensure the prompt row
      // exists too, otherwise the ledger insert fails the FK check.
      await this.prisma.llmPrompt.upsert({
        where: { id: input.promptId },
        create: {
          id: input.promptId,
          name: input.promptId,
          version: input.promptVersion,
          promptText: "",
          variables: "[]",
          isActive: true,
        },
        update: { version: input.promptVersion },
      });
      await this.prisma.llmRun.create({
        data: {
          id: input.id,
          tenantId: input.tenantId,
          operationType: input.operationType,
          resourceId: input.resourceId,
          modelId: input.modelId,
          promptId: input.promptId,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          totalTokens: input.totalTokens,
          costUsd: input.costUsd,
          latencyMs: input.latencyMs,
          status: input.status,
          promptVersion: input.promptVersion,
          modelVersion: input.modelVersion,
          billableUnits: input.billableUnits ?? 0,
          requestId: input.requestId,
        },
      });
      return ok({ id: input.id });
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }
}

function randomId(): string {
  return crypto.randomUUID();
}
