CREATE TABLE "PlatformAdmin" (
  "id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING_ACTIVATION',
  "totpSecretEncrypted" TEXT, "recoveryCodesHash" TEXT NOT NULL DEFAULT '[]',
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0, "lockedUntil" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3), "passwordChangedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "PlatformAdmin_email_key" ON "PlatformAdmin"("email");
CREATE TABLE "PlatformConfiguration" (
  "id" TEXT NOT NULL PRIMARY KEY, "scopeType" TEXT NOT NULL DEFAULT 'GLOBAL', "scopeId" TEXT,
  "category" TEXT NOT NULL, "provider" TEXT NOT NULL, "displayName" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false, "configurationJson" TEXT NOT NULL DEFAULT '{}',
  "secretCiphertext" TEXT, "secretIv" TEXT, "secretTag" TEXT, "secretVersion" INTEGER NOT NULL DEFAULT 1,
  "lastTestStatus" TEXT, "lastTestMessage" TEXT, "lastTestedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "PlatformConfiguration_scopeType_scopeId_category_provider_key" ON "PlatformConfiguration"("scopeType","scopeId","category","provider");
CREATE INDEX "PlatformConfiguration_category_enabled_idx" ON "PlatformConfiguration"("category","enabled");
CREATE TABLE "PlatformAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "actorId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "oldValue" TEXT, "newValue" TEXT,
  "ipAddress" TEXT, "userAgent" TEXT, "prevHash" TEXT NOT NULL DEFAULT '', "hash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PlatformAuditEvent_createdAt_idx" ON "PlatformAuditEvent"("createdAt");
CREATE INDEX "PlatformAuditEvent_entityType_entityId_idx" ON "PlatformAuditEvent"("entityType","entityId");
CREATE TABLE "BackupRun" (
  "id" TEXT NOT NULL PRIMARY KEY, "configurationId" TEXT NOT NULL, "status" TEXT NOT NULL,
  "destination" TEXT NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), "sizeBytes" BIGINT, "checksum" TEXT, "errorMessage" TEXT,
  "restoreTestedAt" TIMESTAMP(3), "restoreStatus" TEXT
);
CREATE INDEX "BackupRun_startedAt_idx" ON "BackupRun"("startedAt");
CREATE TABLE "ConnectorRun" (
  "id" TEXT NOT NULL PRIMARY KEY, "configurationId" TEXT NOT NULL, "tenantId" TEXT NOT NULL,
  "connectorType" TEXT NOT NULL, "status" TEXT NOT NULL, "cursor" TEXT,
  "recordsRead" INTEGER NOT NULL DEFAULT 0, "recordsCreated" INTEGER NOT NULL DEFAULT 0,
  "recordsSkipped" INTEGER NOT NULL DEFAULT 0, "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3)
);
CREATE INDEX "ConnectorRun_tenantId_startedAt_idx" ON "ConnectorRun"("tenantId","startedAt");
