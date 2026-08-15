-- Feature 19: Tiers, entitlements, and payments
-- Adds billing/entitlement tables and extends LlmRun with usage-ledger fields.

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'CREEM',
    "providerCustomerId" TEXT NOT NULL,
    "providerSubscriptionId" TEXT NOT NULL,
    "providerProductId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "catalogVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "unitAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "billingInterval" TEXT NOT NULL DEFAULT 'MONTH',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "providerUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_provider_providerSubscriptionId_key" ON "BillingSubscription"("provider", "providerSubscriptionId");

-- CreateIndex
CREATE INDEX "BillingSubscription_tenantId_status_idx" ON "BillingSubscription"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BillingSubscription_tenantId_providerCustomerId_idx" ON "BillingSubscription"("tenantId", "providerCustomerId");

-- CreateIndex
CREATE INDEX "BillingSubscription_providerSubscriptionId_idx" ON "BillingSubscription"("providerSubscriptionId");

-- CreateTable
CREATE TABLE "EntitlementGrant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "billingSubscriptionId" TEXT,
    "overrideLimitsJson" TEXT,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntitlementGrant_tenantId_idx" ON "EntitlementGrant"("tenantId");

-- CreateIndex
CREATE INDEX "EntitlementGrant_tenantId_source_idx" ON "EntitlementGrant"("tenantId", "source");

-- CreateIndex
CREATE INDEX "EntitlementGrant_tenantId_effectiveFrom_effectiveUntil_idx" ON "EntitlementGrant"("tenantId", "effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE INDEX "EntitlementGrant_billingSubscriptionId_idx" ON "EntitlementGrant"("billingSubscriptionId");

-- CreateTable
CREATE TABLE "BillingEventInbox" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'CREEM',
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "providerCreatedAt" TIMESTAMP(3),
    "tenantId" TEXT,
    "payloadChecksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingEventInbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingEventInbox_provider_providerEventId_key" ON "BillingEventInbox"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "BillingEventInbox_status_idx" ON "BillingEventInbox"("status");

-- CreateIndex
CREATE INDEX "BillingEventInbox_tenantId_idx" ON "BillingEventInbox"("tenantId");

-- CreateIndex
CREATE INDEX "BillingEventInbox_createdAt_idx" ON "BillingEventInbox"("createdAt");

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "used" BIGINT NOT NULL DEFAULT 0,
    "reserved" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_tenantId_metric_periodStart_key" ON "UsageCounter"("tenantId", "metric", "periodStart");

-- CreateIndex
CREATE INDEX "UsageCounter_tenantId_metric_idx" ON "UsageCounter"("tenantId", "metric");

-- CreateTable
CREATE TABLE "TrialIdentity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "emailFingerprint" TEXT NOT NULL,
    "domainFingerprint" TEXT NOT NULL,
    "trialStartedAt" TIMESTAMP(3) NOT NULL,
    "trialEndedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrialIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrialIdentity_emailFingerprint_key" ON "TrialIdentity"("emailFingerprint");

-- CreateIndex
CREATE INDEX "TrialIdentity_domainFingerprint_idx" ON "TrialIdentity"("domainFingerprint");

-- CreateIndex
CREATE INDEX "TrialIdentity_tenantId_idx" ON "TrialIdentity"("tenantId");

-- AlterTable (LlmRun usage ledger)
ALTER TABLE "LlmRun" ADD COLUMN "operationType" TEXT;
ALTER TABLE "LlmRun" ADD COLUMN "resourceId" TEXT;
ALTER TABLE "LlmRun" ADD COLUMN "billableUnits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LlmRun" ADD COLUMN "requestId" TEXT;

-- CreateIndex
CREATE INDEX "LlmRun_tenantId_operationType_createdAt_idx" ON "LlmRun"("tenantId", "operationType", "createdAt");

-- CreateIndex
CREATE INDEX "LlmRun_resourceId_idx" ON "LlmRun"("resourceId");

-- CreateIndex
CREATE INDEX "LlmRun_requestId_idx" ON "LlmRun"("requestId");
