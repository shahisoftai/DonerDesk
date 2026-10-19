-- Phase 28.1-C: custom fields per project and their values on planned activities. Additive only.
-- Re-run infra/postgres/rls.sql afterwards (adds ProjectField and CustomFieldValue; RLS forced).
CREATE TABLE "ProjectField" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "choicesJson" TEXT NOT NULL DEFAULT '[]',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectField_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectField_projectId_key_key" ON "ProjectField"("projectId", "key");
CREATE INDEX "ProjectField_tenantId_projectId_idx" ON "ProjectField"("tenantId", "projectId");

CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomFieldValue_fieldId_entityId_key" ON "CustomFieldValue"("fieldId", "entityId");
CREATE INDEX "CustomFieldValue_tenantId_entityId_idx" ON "CustomFieldValue"("tenantId", "entityId");
